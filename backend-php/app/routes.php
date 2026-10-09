<?php
declare(strict_types=1);

use Koligo\Auth;
use Koligo\Controllers\AdminController as Admin;
use Koligo\Controllers\AuthController as AuthC;
use Koligo\Controllers\DeliveryController as Del;
use Koligo\Controllers\NotificationController as NotifC;
use Koligo\Controllers\PaymentController as Pay;
use Koligo\Controllers\PublicController as Pub;
use Koligo\Controllers\WalletController as Wal;
use Koligo\Router;

/**
 * Meme surface que l'ancien backend Node : chaque groupe est expose sous /api/...
 * et sous son alias historique sans prefixe (l'app mobile utilise les deux).
 */
return function (Router $r): void {
    $jwt = [Auth::class, 'verifyJWT'];
    $role = fn(string ...$roles) => Auth::requireRole(...$roles);

    $r->get('/health', function () {
        $db = false;
        try {
            $db = \Koligo\Db::val('SELECT 1') == 1;
        } catch (\Throwable) {
        }
        return ['ok' => true, 'db' => $db];
    });

    foreach (['/api', ''] as $p) {
        // ── public ───────────────────────────────────────────────────────────
        $r->reset();
        $r->get("$p/public/cities", [Pub::class, 'cities']);
        $r->get("$p/public/pricing", [Pub::class, 'pricing']);
        $r->get("$p/public/quote", [Pub::class, 'quote']);
        $r->get("$p/public/config", [Pub::class, 'config']);
        $r->get("$p/public/cgu", [Pub::class, 'cgu']);
        $r->get("$p/public/distance", [Pub::class, 'distance']);

        // ── auth ─────────────────────────────────────────────────────────────
        foreach (['/otp/send', '/send-otp'] as $path) {
            $r->post("$p/auth$path", [AuthC::class, 'sendOtp']);
        }
        foreach (['/otp/verify', '/verify-otp'] as $path) {
            $r->post("$p/auth$path", [AuthC::class, 'verifyOtp']);
        }
        $r->post("$p/auth/signup", [AuthC::class, 'signup']);
        $r->post("$p/auth/signin", [AuthC::class, 'signin']);
        $r->post("$p/auth/admin/email/start", [AuthC::class, 'adminEmailStart']);
        $r->post("$p/auth/admin/email/verify", [AuthC::class, 'adminEmailVerify']);
        $r->post("$p/auth/admin/change-password", [AuthC::class, 'adminChangePassword'], $jwt, $role('ADMIN'));
        $r->post("$p/auth/admin/email/set-password", [AuthC::class, 'adminEmailSetPassword']);
        $r->post("$p/auth/refresh", [AuthC::class, 'refresh']);
        $r->post("$p/auth/forgot-pin", [AuthC::class, 'forgotPin']);
        $r->post("$p/auth/reset-pin", [AuthC::class, 'resetPin']);
        $r->post("$p/auth/device-session", [AuthC::class, 'deviceSession']);
        $r->post("$p/auth/switch-role", [AuthC::class, 'switchRole'], $jwt);
        $r->post("$p/auth/kyc", [AuthC::class, 'submitKyc'], $jwt);
        $r->post("$p/auth/accept-cgu", [AuthC::class, 'acceptCgu'], $jwt);
        $r->get("$p/auth/profile", [AuthC::class, 'getProfile'], $jwt);
        $r->patch("$p/auth/profile", [AuthC::class, 'updateProfile'], $jwt);

        // ── user ─────────────────────────────────────────────────────────────
        $r->get("$p/user/profile", [AuthC::class, 'getProfile'], $jwt);
        $r->get("$p/user/stats", [AuthC::class, 'stats'], $jwt);
        $r->patch("$p/user/profile", [AuthC::class, 'updateProfile'], $jwt);
        $r->patch("$p/user/payment-account", [AuthC::class, 'updatePaymentAccount'], $jwt);
        $r->post("$p/user/kyc", [AuthC::class, 'submitKyc'], $jwt);
        $r->get("$p/notifications", [NotifC::class, 'list'], $jwt);
        $r->post("$p/notifications/read", [NotifC::class, 'markRead'], $jwt);
        $r->post("$p/user/change-pin", [AuthC::class, 'changePin'], $jwt);

        // ── deliveries : routes publiques d'abord (destinataire sans compte) ──
        $d = "$p/deliveries";
        $r->get("$d/track/:clientToken", [Del::class, 'trackByClientToken']);
        $r->get("$d/by-ref/:ref", [Del::class, 'byRef']);
        $r->get("$d/:id/public", [Del::class, 'publicById']);
        $r->get("$d/:id/public-location", [Del::class, 'publicLocation']);
        $r->get("$d/:id/public-invoice", [Del::class, 'publicInvoice']);
        $r->post("$d/client-pay", [Del::class, 'clientPay']);
        $r->get("$d/client-payment-status", [Del::class, 'clientPaymentStatus']);
        $r->post("$d/client-rate", [Del::class, 'clientRate']);
        $r->post("$d/client-report", [Del::class, 'clientReport']);
        $r->post("$d/:id/client-confirm", [Del::class, 'clientConfirm']);
        $r->post("$d/:id/recipient-message", [Del::class, 'sendRecipientMessage']);
        $r->get("$d/:id/messages-public", [Del::class, 'listMessagesPublic']);

        // ── deliveries : authentifiees ───────────────────────────────────────
        $r->post($d, [Del::class, 'create'], $jwt, $role('VENDOR'));
        $r->get($d, [Del::class, 'list'], $jwt);
        $r->get("$d/available", [Del::class, 'listAvailable'], $jwt, $role('DELIVERER'));
        $r->patch("$d/:id/cancel", [Del::class, 'cancel'], $jwt, $role('VENDOR'));
        $r->get("$d/:id/invoice/:type", [Del::class, 'invoice'], $jwt);
        $r->get("$d/:id/trust-invoice", [Del::class, 'trustInvoice'], $jwt, $role('VENDOR'));
        $r->post("$d/:id/revision", [Del::class, 'proposeRevision'], $jwt, $role('DELIVERER'));
        $r->patch("$d/:id/revision", [Del::class, 'respondRevision'], $jwt, $role('VENDOR'));
        $r->get("$d/:id/revision", [Del::class, 'getRevision'], $jwt);
        $r->get("$d/:id/photo", [Del::class, 'photo'], $jwt);
        $r->get("$d/:id", [Del::class, 'getById'], $jwt);
        $r->patch("$d/:id/accept", [Del::class, 'accept'], $jwt, $role('DELIVERER'));
        $r->patch("$d/:id/confirm-collect", [Del::class, 'confirmCollect'], $jwt, $role('DELIVERER'));
        $r->patch("$d/:id/confirm-deliver", [Del::class, 'confirmDeliver'], $jwt, $role('DELIVERER'));
        $r->post("$d/:id/location", [Del::class, 'postLocation'], $jwt, $role('DELIVERER'));
        $r->get("$d/:id/location", [Del::class, 'getLocation'], $jwt);
        $r->get("$d/:id/messages", [Del::class, 'listMessages'], $jwt);
        $r->post("$d/:id/messages", [Del::class, 'sendMessage'], $jwt);

        // ── wallet / ratings / issues ────────────────────────────────────────
        $r->get("$p/wallet", [Wal::class, 'balance'], $jwt);
        $r->get("$p/wallet/transactions", [Wal::class, 'transactions'], $jwt);
        $r->post("$p/wallet/topup", [Wal::class, 'topUp'], $jwt);
        $r->post("$p/wallet/withdraw", [Wal::class, 'withdraw'], $jwt);
        $r->post("$p/ratings", [Wal::class, 'postRating'], $jwt);
        $r->post("$p/issues", [Wal::class, 'postIssue'], $jwt);

        // ── admin ────────────────────────────────────────────────────────────
        $a = "$p/admin";
        $adm = [$jwt, $role('ADMIN')];
        $r->get("$a/stats", [Admin::class, 'stats'], ...$adm);
        $r->get("$a/notifications", [NotifC::class, 'adminHistory'], ...$adm);
        $r->post("$a/notifications", [NotifC::class, 'adminBroadcast'], ...$adm);
        $r->get("$a/users", [Admin::class, 'listUsers'], ...$adm);
        $r->post("$a/users/create", [Admin::class, 'createUser'], ...$adm);
        $r->get("$a/users/:id", [Admin::class, 'getUser'], ...$adm);
        $r->patch("$a/users/:id/block", [Admin::class, 'blockUser'], ...$adm);
        $r->patch("$a/users/:id/kyc", [Admin::class, 'reviewKyc'], ...$adm);
        $r->get("$a/kyc-doc/:docId", [Admin::class, 'serveKycDoc'], ...$adm);
        $r->get("$a/deliveries", [Admin::class, 'listDeliveries'], ...$adm);
        $r->patch("$a/deliveries/:id/cancel", [Admin::class, 'cancelDelivery'], ...$adm);
        $r->get("$a/finance", [Admin::class, 'finance'], ...$adm);
        $r->patch("$a/withdrawals/:id/pay", [Admin::class, 'payWithdrawal'], ...$adm);
        $r->get("$a/settings", [Admin::class, 'getSettings'], ...$adm);
        $r->patch("$a/settings", [Admin::class, 'updateSetting'], ...$adm);
        $r->get("$a/analytics", [Admin::class, 'analytics'], ...$adm);
        $r->post("$a/test-payment", [Admin::class, 'startTestPayment'], ...$adm);
        $r->get("$a/test-payment/:id", [Admin::class, 'testPaymentStatus'], ...$adm);
        $r->get("$a/pricing", [Admin::class, 'getPricing'], ...$adm);
        $r->patch("$a/pricing", [Admin::class, 'updatePricing'], ...$adm);
        $r->get("$a/cgu", [Admin::class, 'getCgu'], ...$adm);
        $r->post("$a/cgu", [Admin::class, 'publishCgu'], ...$adm);
        $r->get("$a/site-content", [Admin::class, 'getSiteContent'], ...$adm);
        $r->patch("$a/site-content", [Admin::class, 'updateSiteContent'], ...$adm);
        $r->get("$a/issues", [Admin::class, 'listIssues'], ...$adm);
        $r->patch("$a/issues/:id/resolve", [Admin::class, 'resolveIssue'], ...$adm);
        $r->get("$a/packages", [Admin::class, 'listPackages'], ...$adm);
        $r->get("$a/packages/:id", [Admin::class, 'getPackage'], ...$adm);
        $r->get("$a/invoices", [Admin::class, 'listInvoices'], ...$adm);
        $r->get("$a/invoices/:id/:type", [Admin::class, 'getInvoice'], ...$adm);
        $r->get("$a/wallets", [Admin::class, 'listWallets'], ...$adm);
        $r->get("$a/security-events", [Admin::class, 'securityEvents'], ...$adm);
        $r->post("$a/archive", [Admin::class, 'archiveAndReset'], ...$adm);
        $r->get("$a/archives", [Admin::class, 'listArchives'], ...$adm);
        $r->post("$a/archives/:id/restore", [Admin::class, 'restoreArchive'], ...$adm);
        $r->get("$a/export", [Admin::class, 'export'], ...$adm);
        $r->post("$a/wipe-total", [Admin::class, 'wipeTotal'], ...$adm);
        $r->get("$a/cities", [Admin::class, 'listCities'], ...$adm);
        $r->post("$a/cities", [Admin::class, 'createCity'], ...$adm);
        $r->patch("$a/cities/:id", [Admin::class, 'updateCity'], ...$adm);
        $r->delete("$a/cities/:id", [Admin::class, 'deleteCity'], ...$adm);
        $r->get("$a/cities/:cityId/neighborhoods", [Admin::class, 'listNeighborhoods'], ...$adm);
        $r->post("$a/cities/:cityId/neighborhoods", [Admin::class, 'createNeighborhood'], ...$adm);
        $r->patch("$a/neighborhoods/:id", [Admin::class, 'updateNeighborhood'], ...$adm);
        $r->delete("$a/neighborhoods/:id", [Admin::class, 'deleteNeighborhood'], ...$adm);
    }

    // ── paiement : /payment (historique) et /payments (procedure Sungku), avec ou sans /api ──
    $r->reset();
    foreach (['/api/payment', '/payment', '/api/payments', '/payments'] as $p) {
        $r->post("$p/webhook/sungku", [Pay::class, 'webhook']);
        $r->get("$p/success", fn() => Pay::successPage());
        $r->get("$p/cancel", fn() => Pay::cancelPage());
        $r->post("$p/cashout", [Pay::class, 'cashout'], $jwt);
        $r->get("$p/verify/:id", [Pay::class, 'verify'], $jwt);
    }

    // ── page de suivi publique ───────────────────────────────────────────────
    $r->reset();
    $r->get('/track/:id/status', [Pub::class, 'trackStatus']);
    $r->get('/track/:token', [Pub::class, 'trackPage']);
};
