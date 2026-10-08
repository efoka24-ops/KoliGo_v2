<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Env;
use Koligo\HttpError;

/** Stockage des images envoyees par les utilisateurs (KYC, photos de colis). */
final class Uploads
{
    public static function dir(): string
    {
        $dir = Env::get('UPLOAD_DIR') ?: dirname(__DIR__, 2) . '/storage/uploads';
        if (!is_dir($dir)) {
            mkdir($dir, 0750, true);
        }
        return $dir;
    }

    /** Decode une image envoyee en base64 (avec ou sans prefixe data:). */
    public static function decode(string $data): string
    {
        $raw = base64_decode((string)preg_replace('#^data:image/\w+;base64,#', '', $data), true);
        if ($raw === false || $raw === '') {
            throw new HttpError('Image invalide');
        }
        return $raw;
    }

    /** N'ecrit que de vraies images (JPEG/PNG), jamais un fichier arbitraire. */
    public static function storeImage(string $bytes, string $ownerId, string $type): string
    {
        if (strlen($bytes) > 8 * 1024 * 1024) {
            throw new HttpError('Image trop volumineuse');
        }
        $ext = match (true) {
            str_starts_with($bytes, "\xFF\xD8\xFF") => 'jpg',
            str_starts_with($bytes, "\x89PNG") => 'png',
            default => throw new HttpError('Format image invalide (JPEG ou PNG)'),
        };
        $path = self::dir() . '/' . $ownerId . '_' . strtolower($type) . '_' . time() . '_' . bin2hex(random_bytes(3)) . '.' . $ext;
        file_put_contents($path, $bytes);
        return $path;
    }
}
