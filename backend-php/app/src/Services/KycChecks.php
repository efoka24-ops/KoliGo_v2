<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
use Koligo\HttpError;

/**
 * Verification automatique des dossiers KYC (en arriere-plan) avec historique.
 *
 * Ce que le systeme controle : dossier complet, photos lisibles / assez grandes / ni trop sombres ni trop claires /
 * suffisamment nettes, numero de CNI plausible, photos ou numero de CNI deja utilises par un autre compte, selfie
 * different de la CNI. Ce qu'il NE fait PAS : lire la CNI (OCR) ni comparer le visage du selfie avec celui de la CNI.
 *
 * Decision : APPROVE (tout est bon) · REJECT (defaut technique net : le client doit refaire ses photos) · REVIEW
 * (suspicion de fraude, doute ou analyse impossible : un administrateur tranche).
 * Mode (reglage `kyc_auto_mode`) : AUTO applique APPROVE et REJECT, SUGGEST ne fait que recommander, OFF desactive.
 */
final class KycChecks
{
    public const DOC_LABELS = ['ID_FRONT' => 'CNI recto', 'ID_BACK' => 'CNI verso', 'SELFIE' => 'Selfie avec la CNI'];

    // Seuils calibres sur de vraies photos (netteté mesurée à 640 px de large : photos nettes 700 à 2100, floues 250 à 630).
    private const MIN_SIDE_PX = 480;
    private const MIN_BYTES = 20000;
    private const DARK_MEAN = 45;
    private const BRIGHT_MEAN = 235;
    private const FLAT_CONTRAST = 20;
    private const SHARP_ID = 400;      // CNI : en dessous, « peu nette » (doute) ; en dessous de la moitie, « floue » (rejet)
    private const SHARP_SELFIE = 250;
    private const DUP_HAMMING = 4;
    private const SELF_HAMMING = 5;

    public static function mode(): string
    {
        $v = strtoupper((string)Db::val("SELECT `value` FROM `PlatformSetting` WHERE `key` = 'kyc_auto_mode'"));
        return in_array($v, ['AUTO', 'SUGGEST', 'OFF'], true) ? $v : 'AUTO';
    }

    public static function gd(): bool
    {
        return extension_loaded('gd') && function_exists('imagecreatefromstring');
    }

    // ── File d'attente ───────────────────────────────────────────────────────

    /** Met un dossier en file ; renvoie l'identifiant, ou null si la verification est desactivee ou deja en file. */
    public static function enqueue(string $userId, string $by = 'SYSTEM', bool $force = false): ?string
    {
        if (!$force && self::mode() === 'OFF') {
            return null;
        }
        if (Db::one("SELECT id FROM `KycCheck` WHERE userId = ? AND status IN ('QUEUED','RUNNING') AND createdAt > ?", [$userId, gmdate('Y-m-d H:i:s', time() - 600)])) {
            return null;
        }
        $id = Db::id();
        Db::insert('KycCheck', ['id' => $id, 'userId' => $userId, 'status' => 'QUEUED', 'mode' => self::mode(), 'triggeredBy' => $by, 'createdAt' => Db::now()]);
        return $id;
    }

    /** Traite les verifications en attente (appele apres la reponse HTTP et de facon opportuniste : pas de cron garanti). */
    public static function processDue(int $limit = 2): int
    {
        $n = 0;
        while ($n < $limit) {
            $row = Db::one("SELECT id FROM `KycCheck` WHERE status = 'QUEUED' OR (status = 'RUNNING' AND startedAt < ?) ORDER BY createdAt ASC LIMIT 1", [gmdate('Y-m-d H:i:s', time() - 300)]);
            if (!$row) {
                break;
            }
            self::run((string)$row['id']);
            $n++;
        }
        return $n;
    }

    /** Execute une verification (verrou optimiste : deux processus ne traitent pas la meme). */
    public static function run(string $checkId): ?array
    {
        $c = Db::one('SELECT * FROM `KycCheck` WHERE id = ?', [$checkId]);
        if (!$c) {
            return null;
        }
        $now = Db::now();
        $won = Db::exec("UPDATE `KycCheck` SET status = 'RUNNING', startedAt = ? WHERE id = ? AND (status = 'QUEUED' OR (status = 'RUNNING' AND startedAt < ?))", [$now, $checkId, gmdate('Y-m-d H:i:s', time() - 300)]);
        if ($won !== 1) {
            return self::view(Db::one('SELECT * FROM `KycCheck` WHERE id = ?', [$checkId]) ?: $c);
        }
        try {
            @set_time_limit(120);
            $r = self::analyze((string)$c['userId']);
            // Le mode en vigueur au moment de l'execution fait foi (l'administrateur a pu le changer depuis la mise en file).
            $mode = self::mode();
            $applied = 0;
            if ($mode === 'AUTO') {
                $applied = self::apply((string)$c['userId'], $r['decision'], $r['reason'], $r['docIds']) ? 1 : 0;
            }
            Db::exec("UPDATE `KycCheck` SET status = 'DONE', mode = ?, decision = ?, applied = ?, score = ?, findings = ?, reason = ?, docIds = ?, gd = ?, finishedAt = ? WHERE id = ?", [
                $mode, $r['decision'], $applied, $r['score'], json_encode($r['findings'], JSON_UNESCAPED_UNICODE), $r['reason'], json_encode($r['docIds']), self::gd() ? 1 : 0, Db::now(), $checkId,
            ]);
        } catch (\Throwable $e) {
            error_log('[kyc-check] ' . $e->getMessage());
            Db::exec("UPDATE `KycCheck` SET status = 'FAILED', error = ?, finishedAt = ? WHERE id = ?", [mb_substr($e->getMessage(), 0, 250), Db::now(), $checkId]);
        }
        return self::view(Db::one('SELECT * FROM `KycCheck` WHERE id = ?', [$checkId]));
    }

    // ── Analyse ──────────────────────────────────────────────────────────────

    /** @return array{decision:string,reason:?string,score:int,findings:array,docIds:array} */
    public static function analyze(string $userId): array
    {
        $user = Db::one('SELECT id, cniNumber FROM `User` WHERE id = ?', [$userId]);
        if (!$user) {
            throw new HttpError('Utilisateur introuvable', 404);
        }
        $docs = [];
        foreach (Db::all('SELECT * FROM `KycDocument` WHERE userId = ? ORDER BY createdAt ASC, id ASC', [$userId]) as $d) {
            $docs[$d['type']] = $d; // le plus recent de chaque type
        }
        $findings = [];
        $add = function (string $code, string $label, ?bool $ok, string $sev, string $detail = '', ?string $doc = null) use (&$findings) {
            $findings[] = ['code' => $code, 'label' => $label, 'ok' => $ok, 'severity' => $sev, 'detail' => $detail, 'doc' => $doc];
        };

        $missing = array_values(array_diff(array_keys(self::DOC_LABELS), array_keys($docs)));
        $add('DOCS_COMPLETE', 'Dossier complet (CNI recto, verso, selfie)', !$missing, 'DEFECT', $missing ? 'Manquant : ' . implode(', ', array_map(fn($t) => self::DOC_LABELS[$t], $missing)) : '');

        $hashes = [];
        foreach (self::DOC_LABELS as $type => $label) {
            if (!isset($docs[$type])) {
                continue;
            }
            $m = self::measure($docs[$type]);
            $hashes[$type] = ['sha' => $m['sha256'] ?? null, 'ahash' => $m['ahash'] ?? null];
            $isId = $type !== 'SELFIE';
            $add('IMAGE_READABLE', "$label : photo lisible", $m['readable'], 'DEFECT', $m['readable'] ? '' : 'Le fichier n\'est pas une image valide.', $type);
            if (!$m['readable']) {
                continue;
            }
            $add('IMAGE_SIZE', "$label : taille suffisante", $m['minSide'] >= self::MIN_SIDE_PX && $m['bytes'] >= self::MIN_BYTES, 'DEFECT', "{$m['w']}×{$m['h']} px, " . intdiv($m['bytes'], 1024) . ' Ko', $type);
            if (!self::gd()) {
                $add('IMAGE_QUALITY', "$label : luminosité et netteté", null, 'WARN', 'Analyse d\'image indisponible sur ce serveur (extension GD absente).', $type);
                continue;
            }
            $add('BRIGHTNESS', "$label : luminosité correcte", $m['mean'] >= self::DARK_MEAN && $m['mean'] <= self::BRIGHT_MEAN, 'DEFECT', 'luminosité moyenne ' . $m['mean'] . ($m['mean'] < self::DARK_MEAN ? ' (trop sombre)' : ($m['mean'] > self::BRIGHT_MEAN ? ' (trop claire)' : '')), $type);
            $add('CONTRAST', "$label : image non vide", $m['contrast'] >= self::FLAT_CONTRAST, 'DEFECT', 'contraste ' . $m['contrast'], $type);
            $thr = $isId ? self::SHARP_ID : self::SHARP_SELFIE;
            $veryBlurry = $m['sharp'] < $thr / 2;
            $add('SHARPNESS', "$label : photo nette", $m['sharp'] >= $thr, $veryBlurry ? 'DEFECT' : 'WARN', 'netteté ' . $m['sharp'] . ' (seuil ' . $thr . ')' . ($veryBlurry ? ' : floue' : ($m['sharp'] < $thr ? ' : peu nette' : '')), $type);
        }

        // Numero de CNI
        $cni = trim((string)($user['cniNumber'] ?? ''));
        $okFmt = (bool)preg_match('/^\d{8,10}$/', $cni);
        $add('CNI_FORMAT', 'Numéro de CNI renseigné et plausible (8 à 10 chiffres)', $okFmt, 'DEFECT', $cni === '' ? 'non renseigné' : ($okFmt ? '' : 'format inattendu'));
        if ($okFmt) {
            $other = Db::one("SELECT id, name FROM `User` WHERE cniNumber = ? AND id <> ? AND kycStatus IN ('PENDING','VERIFIED') LIMIT 1", [$cni, $userId]);
            $add('CNI_DUPLICATE', 'Numéro de CNI jamais utilisé par un autre compte', $other === null, 'FRAUD', $other ? 'déjà utilisé par : ' . ($other['name'] ?? $other['id']) : '');
        }

        // Photos deja utilisees par un autre compte (copie exacte ou quasi identique)
        $dupes = [];
        foreach ($hashes as $type => $h) {
            if (!$h['sha']) {
                continue;
            }
            $same = Db::one('SELECT d.userId, u.name FROM `KycDocument` d JOIN `User` u ON u.id = d.userId WHERE d.userId <> ? AND d.sha256 = ? LIMIT 1', [$userId, $h['sha']]);
            if (!$same && $h['ahash']) {
                $same = self::nearDuplicate($userId, $type, (string)$h['ahash']);
            }
            if ($same) {
                $dupes[] = self::DOC_LABELS[$type] . ' (compte : ' . ($same['name'] ?? $same['userId']) . ')';
            }
        }
        $add('IMAGE_DUPLICATE', 'Photos jamais utilisées par un autre compte', !$dupes, 'FRAUD', implode(' ; ', $dupes));

        // Le selfie doit etre different de la CNI
        if (isset($hashes['SELFIE'], $hashes['ID_FRONT']) && $hashes['SELFIE']['ahash'] && $hashes['ID_FRONT']['ahash']) {
            $same = $hashes['SELFIE']['sha'] === $hashes['ID_FRONT']['sha'] || self::hamming($hashes['SELFIE']['ahash'], $hashes['ID_FRONT']['ahash']) <= self::SELF_HAMMING;
            $add('SELFIE_DISTINCT', 'Selfie différent de la photo de la CNI', !$same, 'FRAUD', $same ? 'le selfie ressemble à la photo du recto de la CNI' : '');
        }

        $add('FACE_MATCH', 'Comparaison du visage (selfie / CNI)', null, 'INFO', 'Non effectuée automatiquement : nécessite un service de reconnaissance externe. À vérifier par un administrateur en cas de doute.');

        return self::decide($findings, array_map(fn($d) => (string)$d['id'], $docs));
    }

    /** @return array{decision:string,reason:?string,score:int,findings:array,docIds:array} */
    private static function decide(array $findings, array $docIds): array
    {
        $checked = array_filter($findings, fn($f) => $f['ok'] !== null);
        $passed = array_filter($checked, fn($f) => $f['ok'] === true);
        $score = $checked ? (int)round(100 * count($passed) / count($checked)) : 0;
        $failed = fn(string $sev) => array_values(array_filter($findings, fn($f) => $f['ok'] === false && $f['severity'] === $sev));
        $skipped = array_filter($findings, fn($f) => $f['ok'] === null && $f['severity'] === 'WARN');

        if ($fraud = $failed('FRAUD')) {
            return ['decision' => 'REVIEW', 'reason' => 'Suspicion de fraude : ' . implode(' ; ', array_map(fn($f) => $f['label'] . ($f['detail'] ? ' (' . $f['detail'] . ')' : ''), $fraud)), 'score' => $score, 'findings' => $findings, 'docIds' => $docIds];
        }
        if ($defects = $failed('DEFECT')) {
            // Message au client : ce qu'il doit refaire, en clair
            $msgs = [];
            foreach ($defects as $f) {
                $msgs[] = match ($f['code']) {
                    'DOCS_COMPLETE' => 'dossier incomplet (' . $f['detail'] . ')',
                    'IMAGE_READABLE' => ($f['doc'] ? self::DOC_LABELS[$f['doc']] : 'une photo') . ' illisible',
                    'IMAGE_SIZE' => ($f['doc'] ? self::DOC_LABELS[$f['doc']] : 'une photo') . ' trop petite ou trop légère',
                    'BRIGHTNESS' => ($f['doc'] ? self::DOC_LABELS[$f['doc']] : 'une photo') . (str_contains($f['detail'], 'sombre') ? ' trop sombre' : ' trop claire'),
                    'CONTRAST' => ($f['doc'] ? self::DOC_LABELS[$f['doc']] : 'une photo') . ' vide ou uniforme',
                    'SHARPNESS' => ($f['doc'] ? self::DOC_LABELS[$f['doc']] : 'une photo') . ' floue',
                    'CNI_FORMAT' => 'numéro de CNI manquant ou incorrect',
                    default => $f['label'],
                };
            }
            return ['decision' => 'REJECT', 'reason' => 'Dossier à refaire : ' . implode(', ', array_unique($msgs)) . '. Reprenez des photos nettes, bien éclairées, où la CNI est entièrement visible.', 'score' => $score, 'findings' => $findings, 'docIds' => $docIds];
        }
        if ($warn = $failed('WARN')) {
            return ['decision' => 'REVIEW', 'reason' => 'Doute sur la qualité : ' . implode(' ; ', array_map(fn($f) => $f['label'] . ' (' . $f['detail'] . ')', $warn)), 'score' => $score, 'findings' => $findings, 'docIds' => $docIds];
        }
        if ($skipped) {
            return ['decision' => 'REVIEW', 'reason' => 'Analyse d\'image indisponible sur ce serveur : vérification humaine nécessaire.', 'score' => $score, 'findings' => $findings, 'docIds' => $docIds];
        }
        return ['decision' => 'APPROVE', 'reason' => null, 'score' => $score, 'findings' => $findings, 'docIds' => $docIds];
    }

    /** Applique la decision (mode AUTO) si le dossier est toujours en attente et n'a pas change depuis l'analyse. */
    private static function apply(string $userId, string $decision, ?string $reason, array $docIds): bool
    {
        if (!in_array($decision, ['APPROVE', 'REJECT'], true)) {
            return false;
        }
        $u = Db::one('SELECT kycStatus FROM `User` WHERE id = ?', [$userId]);
        if (!$u || $u['kycStatus'] !== 'PENDING') {
            return false;
        }
        // Un nouveau dossier a pu etre envoye pendant l'analyse : on ne decide pas sur des photos qui ne sont plus les dernieres.
        $latest = [];
        foreach (Db::all('SELECT id, type FROM `KycDocument` WHERE userId = ? ORDER BY createdAt ASC, id ASC', [$userId]) as $d) {
            $latest[$d['type']] = (string)$d['id'];
        }
        $now = array_values($latest);
        $then = array_values($docIds);
        sort($now);
        sort($then);
        if ($now !== $then) {
            return false;
        }
        if ($decision === 'APPROVE') {
            Kyc::set($userId, 'VERIFIED', null);
            Notifier::send($userId, 'KYC', 'Identité validée', 'Votre dossier KYC est validé : vous pouvez publier et livrer des colis.');
        } else {
            Kyc::set($userId, 'REJECTED', $reason);
            Notifier::send($userId, 'KYC', 'Dossier KYC à refaire', (string)$reason);
        }
        return true;
    }

    // ── Mesures d'image ──────────────────────────────────────────────────────

    /** Mesures d'un document ; calcule et memorise les empreintes (sha256, ahash) au passage. */
    private static function measure(array $doc): array
    {
        $path = (string)$doc['filePath'];
        $out = ['readable' => false, 'bytes' => 0, 'w' => 0, 'h' => 0, 'minSide' => 0, 'sha256' => null, 'ahash' => null];
        if (!is_file($path)) {
            return $out;
        }
        $bytes = (string)file_get_contents($path);
        $out['bytes'] = strlen($bytes);
        $out['sha256'] = hash('sha256', $bytes);
        $info = @getimagesizefromstring($bytes);
        if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) {
            return $out;
        }
        $out['readable'] = true;
        $out['w'] = (int)$info[0];
        $out['h'] = (int)$info[1];
        $out['minSide'] = min($out['w'], $out['h']);
        if (self::gd()) {
            $m = self::pixels($bytes);
            if ($m) {
                $out = $m + $out;
            }
        }
        Db::exec('UPDATE `KycDocument` SET sha256 = ?, ahash = ? WHERE id = ?', [$out['sha256'], $out['ahash'], $doc['id']]);
        return $out;
    }

    /** Luminosite, contraste, nettete (variance du laplacien a 640 px) et empreinte perceptuelle 8×8. */
    private static function pixels(string $bytes): ?array
    {
        $im = @imagecreatefromstring($bytes);
        if (!$im) {
            return null;
        }
        $w = imagesx($im);
        $h = imagesy($im);
        $tw = min(640, $w);
        $th = max(8, (int)round($h * $tw / $w));
        $s = imagecreatetruecolor($tw, $th);
        imagecopyresampled($s, $im, 0, 0, 0, 0, $tw, $th, $w, $h);
        $g = [];
        $sum = 0.0;
        for ($y = 0; $y < $th; $y++) {
            for ($x = 0; $x < $tw; $x++) {
                $c = imagecolorat($s, $x, $y);
                $l = 0.299 * (($c >> 16) & 255) + 0.587 * (($c >> 8) & 255) + 0.114 * ($c & 255);
                $g[$y][$x] = $l;
                $sum += $l;
            }
        }
        $n = $tw * $th;
        $mean = $sum / $n;
        $sd = 0.0;
        $lapSum = 0.0;
        $lapSq = 0.0;
        $cnt = 0;
        for ($y = 0; $y < $th; $y++) {
            for ($x = 0; $x < $tw; $x++) {
                $sd += ($g[$y][$x] - $mean) ** 2;
                if ($y > 0 && $y < $th - 1 && $x > 0 && $x < $tw - 1) {
                    $v = 4 * $g[$y][$x] - $g[$y - 1][$x] - $g[$y + 1][$x] - $g[$y][$x - 1] - $g[$y][$x + 1];
                    $lapSum += $v;
                    $lapSq += $v * $v;
                    $cnt++;
                }
            }
        }
        $lm = $cnt ? $lapSum / $cnt : 0;
        $sharp = $cnt ? $lapSq / $cnt - $lm * $lm : 0;
        // aHash 8x8
        $t = imagecreatetruecolor(8, 8);
        imagecopyresampled($t, $im, 0, 0, 0, 0, 8, 8, $w, $h);
        $px = [];
        for ($y = 0; $y < 8; $y++) {
            for ($x = 0; $x < 8; $x++) {
                $c = imagecolorat($t, $x, $y);
                $px[] = 0.299 * (($c >> 16) & 255) + 0.587 * (($c >> 8) & 255) + 0.114 * ($c & 255);
            }
        }
        $avg = array_sum($px) / 64;
        $bits = '';
        foreach ($px as $p) {
            $bits .= $p > $avg ? '1' : '0';
        }
        $hex = '';
        foreach (str_split($bits, 4) as $nib) {
            $hex .= dechex(bindec($nib));
        }
        return ['mean' => round($mean, 1), 'contrast' => round(sqrt($sd / $n), 1), 'sharp' => round($sharp, 1), 'ahash' => $hex];
    }

    public static function hamming(string $a, string $b): int
    {
        $d = 0;
        for ($i = 0, $l = min(strlen($a), strlen($b)); $i < $l; $i++) {
            $d += substr_count(decbin(hexdec($a[$i]) ^ hexdec($b[$i])), '1');
        }
        return $d;
    }

    /** Photo quasi identique (meme type) deja envoyee par un autre compte. */
    private static function nearDuplicate(string $userId, string $type, string $ahash): ?array
    {
        $rows = Db::all('SELECT d.userId, d.ahash, u.name FROM `KycDocument` d JOIN `User` u ON u.id = d.userId WHERE d.userId <> ? AND d.type = ? AND d.ahash IS NOT NULL ORDER BY d.createdAt DESC LIMIT 500', [$userId, $type]);
        foreach ($rows as $r) {
            if (self::hamming($ahash, (string)$r['ahash']) <= self::DUP_HAMMING) {
                return $r;
            }
        }
        return null;
    }

    // ── Historique et actions de l'administrateur ───────────────────────────

    public static function view(array $c): array
    {
        $u = Db::one('SELECT name, phone, kycStatus FROM `User` WHERE id = ?', [$c['userId']]) ?: [];
        $by = $c['triggeredBy'] ?? 'SYSTEM';
        $admin = $by !== 'SYSTEM' ? Db::val('SELECT name FROM `User` WHERE id = ?', [$by]) : null;
        return [
            'id' => $c['id'], 'userId' => $c['userId'], 'userName' => $u['name'] ?? null, 'userPhone' => $u['phone'] ?? null, 'kycStatus' => $u['kycStatus'] ?? null,
            'status' => $c['status'], 'decision' => $c['decision'], 'mode' => $c['mode'], 'applied' => (bool)$c['applied'], 'score' => $c['score'] !== null ? (int)$c['score'] : null,
            'findings' => $c['findings'] ? json_decode((string)$c['findings'], true) : [], 'reason' => $c['reason'], 'error' => $c['error'],
            'gd' => (bool)$c['gd'], 'triggeredBy' => $by === 'SYSTEM' ? 'Système' : ($admin ?: 'Administrateur'),
            'createdAt' => $c['createdAt'], 'startedAt' => $c['startedAt'], 'finishedAt' => $c['finishedAt'],
        ];
    }

    public static function history(array $q, int $take, int $skip): array
    {
        $where = '1=1';
        $args = [];
        if (!empty($q['userId'])) {
            $where .= ' AND c.userId = ?';
            $args[] = (string)$q['userId'];
        }
        $dec = strtoupper((string)($q['decision'] ?? ''));
        if (in_array($dec, ['APPROVE', 'REJECT', 'REVIEW'], true)) {
            $where .= ' AND c.decision = ?';
            $args[] = $dec;
        }
        if (strtoupper((string)($q['status'] ?? '')) === 'FAILED') {
            $where .= " AND c.status = 'FAILED'";
        }
        $rows = Db::all("SELECT c.* FROM `KycCheck` c WHERE $where ORDER BY c.createdAt DESC, c.id DESC LIMIT $take OFFSET $skip", $args);
        return [
            'items' => array_map([self::class, 'view'], $rows),
            'total' => (int)Db::val("SELECT COUNT(*) FROM `KycCheck` c WHERE $where", $args),
            'stats' => [
                'queued' => (int)Db::val("SELECT COUNT(*) FROM `KycCheck` WHERE status IN ('QUEUED','RUNNING')"),
                'autoApproved' => (int)Db::val("SELECT COUNT(*) FROM `KycCheck` WHERE decision = 'APPROVE' AND applied = 1"),
                'autoRejected' => (int)Db::val("SELECT COUNT(*) FROM `KycCheck` WHERE decision = 'REJECT' AND applied = 1"),
                'review' => (int)Db::val("SELECT COUNT(*) FROM `KycCheck` c JOIN `User` u ON u.id = c.userId WHERE c.decision = 'REVIEW' AND u.kycStatus = 'PENDING' AND c.id = (SELECT c2.id FROM `KycCheck` c2 WHERE c2.userId = c.userId ORDER BY c2.createdAt DESC, c2.id DESC LIMIT 1)"),
                'failed' => (int)Db::val("SELECT COUNT(*) FROM `KycCheck` WHERE status = 'FAILED'"),
            ],
            'mode' => self::mode(), 'gd' => self::gd(),
        ];
    }

    /** Relance une verification (et l'execute tout de suite). L'effet suit le mode : le dossier doit etre en attente pour etre decide. */
    public static function rerun(string $userId, string $adminId): array
    {
        if (!Db::one('SELECT id FROM `User` WHERE id = ?', [$userId])) {
            throw new HttpError('Utilisateur introuvable', 404);
        }
        $id = self::enqueue($userId, $adminId, true);
        if ($id === null) {
            // une verification est deja en file : on l'execute
            $id = (string)Db::val("SELECT id FROM `KycCheck` WHERE userId = ? AND status IN ('QUEUED','RUNNING') ORDER BY createdAt DESC LIMIT 1", [$userId]);
        }
        Db::insert('AdminAction', ['id' => Db::id(), 'adminId' => $adminId, 'userId' => $userId, 'action' => 'KYC_RERUN', 'createdAt' => Db::now()]);
        return self::run($id) ?? throw new HttpError('Vérification introuvable', 404);
    }

    /** Remet un dossier valide ou refuse en attente (par exemple apres une validation automatique contestable), puis le reverifie. */
    public static function reopen(string $userId, string $adminId): array
    {
        $u = Db::one('SELECT kycStatus FROM `User` WHERE id = ?', [$userId]);
        if (!$u) {
            throw new HttpError('Utilisateur introuvable', 404);
        }
        if ($u['kycStatus'] === 'NONE') {
            throw new HttpError('Aucun dossier à rouvrir', 409);
        }
        Kyc::set($userId, 'PENDING', null);
        Db::insert('AdminAction', ['id' => Db::id(), 'adminId' => $adminId, 'userId' => $userId, 'action' => 'KYC_REOPEN', 'createdAt' => Db::now()]);
        Notifier::send($userId, 'KYC', 'Dossier KYC en vérification', 'Votre dossier KYC est de nouveau en cours de vérification.');
        return self::rerun($userId, $adminId);
    }

    /** Verifications recentes d'un utilisateur (fiche du back-office). */
    public static function forUser(string $userId, int $n = 5): array
    {
        return array_map([self::class, 'view'], Db::all('SELECT * FROM `KycCheck` WHERE userId = ? ORDER BY createdAt DESC, id DESC LIMIT ' . (int)$n, [$userId]));
    }
}
