import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import * as ctrl from '../controllers/admin.controller';

const router = Router();
router.use(verifyJWT, requireRole('ADMIN'));

router.get('/stats',                  ctrl.getStats);
router.get('/users',                  ctrl.listUsers);
router.get('/users/:id',              ctrl.getUser);
router.patch('/users/:id/block',      ctrl.blockUser);
router.patch('/users/:id/kyc',        ctrl.reviewKyc);
router.get('/kyc-doc/:docId',         ctrl.serveKycDoc);
router.get('/deliveries',             ctrl.listDeliveries);
router.patch('/deliveries/:id/cancel',ctrl.cancelDelivery);
router.get('/finance',                ctrl.getFinance);
router.patch('/withdrawals/:id/pay',  ctrl.payWithdrawal);
router.get('/settings',               ctrl.getSettings);
router.patch('/settings',             ctrl.updateSetting);

// Issues / Support
router.get('/issues',                        ctrl.listIssues);
router.patch('/issues/:id/resolve',          ctrl.resolveIssue);

// Packages (deliveries with full detail)
router.get('/packages',                      ctrl.listPackages);
router.get('/packages/:id',                  ctrl.getPackage);

// Wallets
router.get('/wallets',                       ctrl.listWallets);

// Security events (PIN resets, KYC actions)
router.get('/security-events',               ctrl.listSecurityEvents);

// User creation by admin
router.post('/users/create',                 ctrl.createUser);

// DB Archive & Reset
router.post('/archive',                      ctrl.archiveAndReset);
router.get('/archives',                      ctrl.listArchives);
router.post('/archives/:id/restore',         ctrl.restoreArchive);
router.get('/export',                        ctrl.exportDb);
router.post('/wipe-total',                   ctrl.wipeTotal);

// Cities & Neighborhoods
router.get('/cities',                       ctrl.listCities);
router.post('/cities',                      ctrl.createCity);
router.patch('/cities/:id',                 ctrl.updateCity);
router.delete('/cities/:id',                ctrl.deleteCity);
router.get('/cities/:cityId/neighborhoods', ctrl.listNeighborhoods);
router.post('/cities/:cityId/neighborhoods',ctrl.createNeighborhood);
router.patch('/neighborhoods/:id',          ctrl.updateNeighborhood);
router.delete('/neighborhoods/:id',         ctrl.deleteNeighborhood);

export default router;
