<?php
declare(strict_types=1);

// Point d'entree unique. Deux dispositions sont supportees :
//   - serveur : index.php et app/ cote a cote (le docroot est la racine FTP) ;
//   - dev     : public_html/ avec app/ a cote.
$app = is_dir(__DIR__ . '/app') ? __DIR__ . '/app' : __DIR__ . '/../app';
require $app . '/bootstrap.php';
koligo_run();
