<?php
// Test en processus du moteur de verification KYC (base SQLite en memoire, images generees).
//   DB_DRIVER=sqlite DB_SQLITE_PATH=:memory: php tests/kyc_checks_test.php
require __DIR__ . '/../app/bootstrap.php';

use Koligo\Db;
use Koligo\Setup;
use Koligo\Services\KycChecks;

Setup::migrate();
Setup::seedReference();

$pass = 0;
$fail = 0;
function ck(string $n, bool $ok, $d = ''): void
{
    global $pass, $fail;
    $ok ? $pass++ : $fail++;
    echo ($ok ? '  ok   ' : '  FAIL ') . $n . ($ok ? '' : '  -> ' . (is_string($d) ? $d : json_encode($d))) . PHP_EOL;
}

$dir = sys_get_temp_dir() . '/kyc_test_' . bin2hex(random_bytes(4));
mkdir($dir, 0777, true);

/** Image « photo de CNI » : du bruit couleur (donc tres net), differente a chaque graine. */
function img(string $path, int $seed, string $variant = 'ok'): string
{
    mt_srand($seed);
    $w = 900;
    $h = 900;
    $im = imagecreatetruecolor($w, $h);
    for ($y = 0; $y < $h; $y += 3) {
        for ($x = 0; $x < $w; $x += 3) {
            imagefilledrectangle($im, $x, $y, $x + 2, $y + 2, imagecolorallocate($im, mt_rand(40, 220), mt_rand(40, 220), mt_rand(40, 220)));
        }
    }
    if ($variant === 'blur') {
        $s = imagecreatetruecolor(30, 30);
        imagecopyresampled($s, $im, 0, 0, 0, 0, 30, 30, $w, $h);
        imagecopyresampled($im, $s, 0, 0, 0, 0, $w, $h, 30, 30);
    }
    if ($variant === 'dark') {
        imagefilter($im, IMG_FILTER_BRIGHTNESS, -200);
    }
    imagejpeg($im, $path, 85);
    return $path;
}

function mkUser(string $id, string $cni, string $status = 'PENDING'): void
{
    $now = Db::now();
    Db::insert('User', ['id' => $id, 'name' => "Client $id", 'phone' => '+23760' . random_int(1000000, 9999999), 'pinHash' => 'x', 'roles' => json_encode(['VENDOR']),
        'activeRole' => 'VENDOR', 'cniNumber' => $cni, 'kycStatus' => $status, 'createdAt' => $now, 'updatedAt' => $now]);
}

function docs(string $uid, array $paths): void
{
    foreach ($paths as $type => $p) {
        Db::insert('KycDocument', ['id' => Db::id(), 'userId' => $uid, 'type' => $type, 'role' => 'VENDOR', 'filePath' => $p, 'createdAt' => Db::now()]);
    }
}

function status(string $uid): string
{
    return (string)Db::val('SELECT kycStatus FROM `User` WHERE id = ?', [$uid]);
}

function check(string $uid): array
{
    $id = KycChecks::enqueue($uid, 'SYSTEM', true);
    return KycChecks::run($id);
}

echo 'GD : ' . (KycChecks::gd() ? 'oui' : 'NON') . PHP_EOL;
ck('mode par defaut : AUTO', KycChecks::mode() === 'AUTO');

// 1. Dossier correct -> approuve automatiquement
mkUser('u1', '100637598');
docs('u1', ['ID_FRONT' => img("$dir/a_front.jpg", 1), 'ID_BACK' => img("$dir/a_back.jpg", 2), 'SELFIE' => img("$dir/a_self.jpg", 3)]);
$r = check('u1');
ck('dossier correct : APPROVE, applique, compte VERIFIE', $r['decision'] === 'APPROVE' && $r['applied'] === true && status('u1') === 'VERIFIED' && $r['score'] === 100, $r);
ck('validation automatique : notification envoyee', (int)Db::val("SELECT COUNT(*) FROM Notification WHERE userId = 'u1' AND title = 'Identité validée'") === 1);
ck('historique : ligne enregistree (systeme, AUTO)', $r['triggeredBy'] === 'Système' && $r['mode'] === 'AUTO' && count($r['findings']) >= 8);
ck('la comparaison du visage est signalee comme non effectuee', (bool)array_filter($r['findings'], fn($f) => $f['code'] === 'FACE_MATCH' && $f['ok'] === null));

// 2. Photo floue -> rejet automatique avec message clair
mkUser('u2', '200111222');
docs('u2', ['ID_FRONT' => img("$dir/b_front.jpg", 11, 'blur'), 'ID_BACK' => img("$dir/b_back.jpg", 12), 'SELFIE' => img("$dir/b_self.jpg", 13)]);
$r = check('u2');
ck('CNI recto floue : REJECT applique, motif explicite', $r['decision'] === 'REJECT' && status('u2') === 'REJECTED' && str_contains((string)$r['reason'], 'CNI recto floue'), $r['reason']);
ck('rejet : le motif est conserve pour le client', str_contains((string)Db::val("SELECT kycRejectionReason FROM User WHERE id = 'u2'") ?: (string)$r['reason'], 'floue'));

// 3. Selfie trop sombre
mkUser('u3', '300111222');
docs('u3', ['ID_FRONT' => img("$dir/c_front.jpg", 21), 'ID_BACK' => img("$dir/c_back.jpg", 22), 'SELFIE' => img("$dir/c_self.jpg", 23, 'dark')]);
$r = check('u3');
ck('selfie trop sombre : REJECT', $r['decision'] === 'REJECT' && str_contains((string)$r['reason'], 'trop sombre'), $r['reason']);

// 4. Dossier incomplet
mkUser('u4', '400111222');
docs('u4', ['ID_FRONT' => img("$dir/d_front.jpg", 31), 'ID_BACK' => img("$dir/d_back.jpg", 32)]);
$r = check('u4');
ck('dossier incomplet (sans selfie) : REJECT', $r['decision'] === 'REJECT' && str_contains((string)$r['reason'], 'incomplet'), $r['reason']);

// 5. Photo deja utilisee par un autre compte -> revue humaine, jamais d'approbation automatique
mkUser('u5', '500111222');
docs('u5', ['ID_FRONT' => "$dir/a_front.jpg", 'ID_BACK' => img("$dir/e_back.jpg", 42), 'SELFIE' => img("$dir/e_self.jpg", 43)]);
$r = check('u5');
ck('photo deja utilisee par u1 : REVIEW, reste en attente', $r['decision'] === 'REVIEW' && $r['applied'] === false && status('u5') === 'PENDING' && str_contains((string)$r['reason'], 'fraude'), $r['reason']);
ck('la fraude est detaillee dans les controles', (bool)array_filter($r['findings'], fn($f) => $f['code'] === 'IMAGE_DUPLICATE' && $f['ok'] === false && str_contains($f['detail'], 'Client u1')));

// 6. Numero de CNI deja utilise
mkUser('u6', '100637598');
docs('u6', ['ID_FRONT' => img("$dir/f_front.jpg", 51), 'ID_BACK' => img("$dir/f_back.jpg", 52), 'SELFIE' => img("$dir/f_self.jpg", 53)]);
$r = check('u6');
ck('numero de CNI deja utilise (u1) : REVIEW', $r['decision'] === 'REVIEW' && status('u6') === 'PENDING', $r['reason']);

// 7. Selfie identique a la CNI
mkUser('u7', '700111222');
docs('u7', ['ID_FRONT' => img("$dir/g_front.jpg", 61), 'ID_BACK' => img("$dir/g_back.jpg", 62), 'SELFIE' => "$dir/g_front.jpg"]);
$r = check('u7');
ck('selfie = photo de la CNI : REVIEW', $r['decision'] === 'REVIEW' && (bool)array_filter($r['findings'], fn($f) => $f['code'] === 'SELFIE_DISTINCT' && $f['ok'] === false), $r['reason']);

// 8. CNI absente / mal formee
mkUser('u8', 'abc');
docs('u8', ['ID_FRONT' => img("$dir/h_front.jpg", 71), 'ID_BACK' => img("$dir/h_back.jpg", 72), 'SELFIE' => img("$dir/h_self.jpg", 73)]);
$r = check('u8');
ck('numero de CNI invalide : REJECT', $r['decision'] === 'REJECT' && str_contains((string)$r['reason'], 'numéro de CNI'), $r['reason']);

// 9. Mode SUGGEST : recommande sans appliquer
Db::exec("INSERT INTO PlatformSetting (`key`, `value`, updatedAt) VALUES ('kyc_auto_mode', 'SUGGEST', ?)", [Db::now()]);
mkUser('u9', '900111222');
docs('u9', ['ID_FRONT' => img("$dir/i_front.jpg", 81), 'ID_BACK' => img("$dir/i_back.jpg", 82), 'SELFIE' => img("$dir/i_self.jpg", 83)]);
$r = check('u9');
ck('mode SUGGEST : APPROVE recommande mais NON applique', $r['decision'] === 'APPROVE' && $r['applied'] === false && $r['mode'] === 'SUGGEST' && status('u9') === 'PENDING', $r);

// 10. Mode OFF : rien n'est mis en file
Db::exec("UPDATE PlatformSetting SET `value` = 'OFF' WHERE `key` = 'kyc_auto_mode'");
ck('mode OFF : aucune verification mise en file', KycChecks::enqueue('u9') === null);
Db::exec("UPDATE PlatformSetting SET `value` = 'AUTO' WHERE `key` = 'kyc_auto_mode'");

// 11. File d'attente en arriere-plan
mkUser('u10', '101111222');
docs('u10', ['ID_FRONT' => img("$dir/j_front.jpg", 91), 'ID_BACK' => img("$dir/j_back.jpg", 92), 'SELFIE' => img("$dir/j_self.jpg", 93)]);
$q = KycChecks::enqueue('u10');
ck('file : verification en attente', $q !== null && Db::val('SELECT status FROM KycCheck WHERE id = ?', [$q]) === 'QUEUED');
ck('file : pas de doublon pour le meme dossier', KycChecks::enqueue('u10') === null);
ck('file : processDue traite la verification', KycChecks::processDue(5) >= 1 && Db::val('SELECT status FROM KycCheck WHERE id = ?', [$q]) === 'DONE' && status('u10') === 'VERIFIED');

// 12. Relance par un administrateur
$r = KycChecks::rerun('u2', 'adminX');
ck('relance sur dossier refuse : analysee mais non appliquee (hors attente)', $r['triggeredBy'] === 'Administrateur' && $r['applied'] === false && status('u2') === 'REJECTED', $r);
// u2 renvoie de bonnes photos puis l'admin rouvre
docs('u2', ['ID_FRONT' => img("$dir/b2_front.jpg", 111)]);
$r = KycChecks::reopen('u2', 'adminX');
ck('reouverture : dossier remis en attente, reverifie, valide automatiquement', $r['decision'] === 'APPROVE' && $r['applied'] === true && status('u2') === 'VERIFIED', $r);
ck('actions de l\'administrateur journalisees', (int)Db::val("SELECT COUNT(*) FROM AdminAction WHERE action IN ('KYC_RERUN','KYC_REOPEN')") >= 3);
$r = KycChecks::reopen('u1', 'adminX');
ck('reouverture d\'un dossier valide : les doublons apparus depuis (photo et CNI reutilisees par u5, u6) sont detectes -> REVIEW, reste en attente', $r['decision'] === 'REVIEW' && status('u1') === 'PENDING', $r['reason']);

// 13. Historique
$h = KycChecks::history([], 50, 0);
ck('historique : toutes les verifications, plus recentes d\'abord', $h['total'] >= 12 && $h['items'][0]['createdAt'] >= $h['items'][count($h['items']) - 1]['createdAt'], $h['total']);
ck('historique : statistiques', $h['stats']['autoApproved'] >= 3 && $h['stats']['autoRejected'] >= 3 && $h['stats']['review'] >= 2, $h['stats']);
ck('historique : filtre par decision', count(KycChecks::history(['decision' => 'REVIEW'], 50, 0)['items']) >= 3);
ck('historique : filtre par utilisateur', count(KycChecks::history(['userId' => 'u2'], 50, 0)['items']) === 3);
ck('fiche utilisateur : dernieres verifications', count(KycChecks::forUser('u2', 5)) === 3);

// 14. Dossier modifie pendant l'analyse : la decision ne s'applique pas
mkUser('u11', '111111222');
docs('u11', ['ID_FRONT' => img("$dir/k_front.jpg", 121), 'ID_BACK' => img("$dir/k_back.jpg", 122), 'SELFIE' => img("$dir/k_self.jpg", 123)]);
$an = KycChecks::analyze('u11');
docs('u11', ['SELFIE' => img("$dir/k_self2.jpg", 124)]); // nouveau selfie envoye entre-temps
$ref = new ReflectionMethod(KycChecks::class, 'apply');
$ref->setAccessible(true);
ck('photos remplacees pendant l\'analyse : decision non appliquee', $ref->invoke(null, 'u11', $an['decision'], $an['reason'], $an['docIds']) === false && status('u11') === 'PENDING');

echo PHP_EOL . "Resultat : $pass ok, $fail echec(s)" . PHP_EOL;
array_map('unlink', glob("$dir/*"));
rmdir($dir);
exit($fail ? 1 : 0);
