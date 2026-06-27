import { Router } from 'express';
import authRoutes from './auth';
import clientRoutes from './clients';
import productRoutes from './products';
import invoiceRoutes from './invoices';
import paymentRoutes from './payments';
import caisseRoutes from './caisse';
import dashboardRoutes from './dashboard';
import stockRoutes from './stock';
import arrivalRoutes from './arrivals';
import truckRoutes from './trucks';
import warehouseRoutes from './warehouses';
import alertRoutes from './alerts';
import notificationRoutes from './notifications';
import truckExpenseRoutes from './truckExpenses';

const router = Router();

router.use('/auth', authRoutes);
router.use('/clients', clientRoutes);
router.use('/products', productRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/caisse', caisseRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/stock', stockRoutes);
router.use('/arrivals', arrivalRoutes);
router.use('/trucks', truckRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/alerts', alertRoutes);
router.use('/notifications', notificationRoutes);
router.use('/truck-expenses', truckExpenseRoutes);

export default router;
