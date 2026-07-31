import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { tablesRouter } from './modules/tables/tables.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { inventoryRouter } from './modules/inventory/inventory.routes';
import { shiftsRouter } from './modules/shifts/shifts.routes';
import { kitchenRouter } from './modules/kitchen/kitchen.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { usersRouter } from './modules/users/users.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { receiptsRouter } from './modules/receipts/receipts.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { deliveryRouter } from './modules/delivery/delivery.routes';
import { uploadsRouter } from './modules/uploads/uploads.routes';
import { publicRouter } from './modules/public/public.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', ts: Date.now() } }));

apiRouter.use('/auth', authRouter);
apiRouter.use('/catalog', catalogRouter);
apiRouter.use('/tables', tablesRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/shifts', shiftsRouter);
apiRouter.use('/kitchen', kitchenRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/customers', customersRouter);
apiRouter.use('/receipts', receiptsRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/delivery', deliveryRouter);
apiRouter.use('/uploads', uploadsRouter);
apiRouter.use('/public', publicRouter);
