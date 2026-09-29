import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, disconnectDatabase } from '../infrastructure/database/connection.js';
import { connectRedis, disconnectRedis } from '../infrastructure/cache/redis.js';
import { hashPassword } from '../modules/auth/auth.service.js';
import { PermissionModel } from '../modules/users/permission.model.js';
import { RoleModel } from '../modules/users/role.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { logger } from '../infrastructure/logging/logger.js';
import { loadFreshmartSeedFromFile } from './loadFreshmartSeed.js';

const PERMISSIONS = [
  ['product.read', 'Read products', 'products'],
  ['product.create', 'Create products', 'products'],
  ['product.update', 'Update products', 'products'],
  ['product.delete', 'Delete products', 'products'],
  ['vendor.read', 'Read vendors', 'vendors'],
  ['vendor.create', 'Create vendors', 'vendors'],
  ['vendor.update', 'Update vendors', 'vendors'],
  ['vendor.delete', 'Deactivate vendors', 'vendors'],
  ['category.create', 'Create categories', 'categories'],
  ['category.update', 'Update categories', 'categories'],
  ['order.read', 'Read orders', 'orders'],
  ['order.update', 'Update orders', 'orders'],
  ['pricing.update', 'Update pricing', 'pricing'],
  ['configuration.read', 'Read configuration', 'configuration'],
  ['configuration.update', 'Update configuration', 'configuration'],
  ['report.read', 'Read reports', 'reports'],
  ['delivery.read', 'Read delivery operations', 'delivery'],
  ['delivery.manage', 'Manage delivery persons', 'delivery'],
] as const;

async function seed() {
  await connectDatabase();
  try {
    await connectRedis();
  } catch {
    logger.warn('Redis not available during seed');
  }

  for (const [code, name, module] of PERMISSIONS) {
    await PermissionModel.updateOne({ code }, { code, name, module }, { upsert: true });
  }

  const allPermissionCodes = PERMISSIONS.map((p) => p[0]);

  const roles = [
    { code: 'SUPER_ADMIN', name: 'Super Admin', permissionCodes: allPermissionCodes },
    { code: 'ADMIN', name: 'Admin', permissionCodes: allPermissionCodes },
    { code: 'CUSTOMER', name: 'Customer', permissionCodes: [] },
    { code: 'DELIVERY', name: 'Delivery person', permissionCodes: [] },
    { code: 'VENDOR', name: 'Vendor staff', permissionCodes: [] },
  ];

  for (const role of roles) {
    await RoleModel.updateOne({ code: role.code }, role, { upsert: true });
  }

  const superAdminRole = await RoleModel.findOne({ code: 'SUPER_ADMIN' });
  if (superAdminRole) {
    const legacyAdmin = await UserModel.findOne({ email: 'admin@dream.local' });
    if (!legacyAdmin) {
      await UserModel.create({
        email: 'admin@dream.local',
        passwordHash: await hashPassword('Admin@12345'),
        firstName: 'Super',
        lastName: 'Admin',
        roleIds: [superAdminRole._id],
        isActive: true,
        emailVerified: true,
      });
    }
  }

  await loadFreshmartSeedFromFile();

  logger.info('Development seed completed');
  await disconnectDatabase();
  await disconnectRedis();
}

seed().catch(async (err) => {
  logger.error({ err }, 'Seed failed');
  await disconnectDatabase();
  process.exit(1);
});
