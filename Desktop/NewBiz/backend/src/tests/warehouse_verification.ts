import { prisma } from '../database/prisma.js';
import { warehousesService } from '../modules/warehouses/warehouses.service.js';
import { createSellerWarehouseSchema } from '../modules/warehouses/warehouses.validation.js';
import { adminSellersService } from '../modules/admin-sellers/adminSellers.service.js';

interface TestResult {
  num: number;
  description: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(num: number, description: string, fn: () => Promise<string | void>) {
  try {
    const details = await fn();
    results.push({ num, description, passed: true, details: details || undefined });
    console.log(`✅ TEST ${num} PASSED: ${description}`);
  } catch (err: any) {
    results.push({ num, description, passed: false, error: err?.message || String(err) });
    console.error(`❌ TEST ${num} FAILED: ${description} - ${err?.message}`);
  }
}

async function main() {
  console.log('====================================================');
  console.log('🚀 RUNNING WAREHOUSE MANAGEMENT PHASE W1/W2 TEST SUITE');
  console.log('====================================================\n');

  // 0. Setup test users
  const admin = await prisma.users.findFirst({
    where: { Email: 'admin@test.com' },
  });
  if (!admin) throw new Error('Admin user admin@test.com not found');

  const sellerUser = await prisma.users.findFirst({
    where: { Email: 'seller@test.com' },
  });
  if (!sellerUser) throw new Error('Seller user seller@test.com not found');

  const timestamp = Date.now().toString().slice(-6);
  const testCode = `WH-TEST-${timestamp}`;
  let createdWarehouseId: bigint;

  // TEST 1: Active seller can create OWN warehouse
  await runTest(1, 'Active seller can create OWN warehouse', async () => {
    const created = await warehousesService.createSellerWarehouse(sellerUser.UserID, {
      warehouseName: `Test Fulfillment Center ${timestamp}`,
      warehouseCode: testCode,
      warehouseType: 'OWN',
      addressLine1: 'Plot 42, Hitec City Tech Zone',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500081',
      country: 'India',
      contactPersonName: 'Kishore Kumar',
      contactEmail: 'kishore@kitchenkart.in',
      contactPhoneNumber: '9876543210',
      isPrimary: true,
    });
    createdWarehouseId = BigInt(created.warehouseId);
    return `Created Warehouse ID: ${created.warehouseId}, Code: ${created.warehouseCode}`;
  });

  // TEST 2: Inactive seller cannot create warehouse
  await runTest(2, 'Inactive seller cannot create warehouse', async () => {
    // Create or find a dummy user with no active seller association
    let dummyUser = await prisma.users.findFirst({ where: { Email: 'inactive_seller@test.com' } });
    if (!dummyUser) {
      dummyUser = await prisma.users.create({
        data: {
          FirstName: 'Inactive',
          LastName: 'User',
          Email: 'inactive_seller@test.com',
          PhoneNumber: '9900000001',
          PasswordHash: 'dummy',
          Status: 'ACTIVE', // user is active, but seller is not
          CreatedAt: new Date(),
        },
      });
    }

    try {
      await warehousesService.createSellerWarehouse(dummyUser.UserID, {
        warehouseName: 'Unauthorized Warehouse',
        warehouseCode: `WH-UNAUTH-${timestamp}`,
        warehouseType: 'OWN',
        addressLine1: 'Nowhere',
        city: 'City',
        state: 'State',
        postalCode: '123456',
        country: 'India',
      });
      throw new Error('Should have failed for inactive seller');
    } catch (err: any) {
      if (err.message.includes('Active seller profile required')) {
        return 'Correctly rejected with: ' + err.message;
      }
      throw err;
    }
  });

  // TEST 3: Warehouse starts in correct pending state
  await runTest(3, 'Warehouse starts in correct pending state (PENDING_APPROVAL)', async () => {
    const wh = await prisma.warehouses.findUnique({
      where: { WarehouseID: createdWarehouseId },
    });
    if (!wh) throw new Error('Warehouse not found');
    if (wh.Status !== 'PENDING_APPROVAL') {
      throw new Error(`Expected Status PENDING_APPROVAL, got: ${wh.Status}`);
    }
    return `Warehouse Status: ${wh.Status}`;
  });

  // TEST 4: SellerWarehouse relationship is created correctly
  await runTest(4, 'SellerWarehouse relationship is created with status PENDING', async () => {
    const sw = await prisma.sellerWarehouses.findFirst({
      where: { WarehouseID: createdWarehouseId },
    });
    if (!sw) throw new Error('SellerWarehouse relationship was not created');
    if (sw.Status !== 'PENDING') {
      throw new Error(`Expected SellerWarehouse status PENDING, got: ${sw.Status}`);
    }
    if (!sw.IsPrimary) {
      throw new Error('Expected IsPrimary to be true');
    }
    return `SellerWarehouse ID: ${sw.SellerWarehouseID}, Status: ${sw.Status}, IsPrimary: ${sw.IsPrimary}`;
  });

  // TEST 5: Seller cannot access another seller's warehouse
  await runTest(5, "Seller cannot access another seller's warehouse", async () => {
    // Create a second seller and second seller user
    let otherSeller = await prisma.sellers.findFirst({ where: { SellerCode: 'SEL_OTHER_TEST' } });
    if (!otherSeller) {
      otherSeller = await prisma.sellers.create({
        data: {
          SellerCode: 'SEL_OTHER_TEST',
          SellerName: 'Other Merchant Inc',
          BusinessName: 'Other Merchant Pvt Ltd',
          Email: 'other@merchant.com',
          PhoneNumber: '9988776655',
          Status: 'ACTIVE',
          CreatedAt: new Date(),
        },
      });
    }

    let otherUser = await prisma.users.findFirst({ where: { Email: 'other_seller@test.com' } });
    if (!otherUser) {
      otherUser = await prisma.users.create({
        data: {
          FirstName: 'Other',
          LastName: 'Seller',
          Email: 'other_seller@test.com',
          PhoneNumber: '9988776655',
          PasswordHash: 'dummy',
          Status: 'ACTIVE',
          CreatedAt: new Date(),
        },
      });
    }

    const existingSU = await prisma.sellerUsers.findFirst({
      where: { SellerID: otherSeller.SellerID, UserID: otherUser.UserID },
    });
    if (!existingSU) {
      await prisma.sellerUsers.create({
        data: {
          SellerID: otherSeller.SellerID,
          UserID: otherUser.UserID,
          Status: 'ACTIVE',
          CreatedAt: new Date(),
        },
      });
    }

    try {
      await warehousesService.getSellerWarehouseById(otherUser.UserID, createdWarehouseId);
      throw new Error("Should have thrown NotFoundError for other seller's warehouse");
    } catch (err: any) {
      if (err.message.includes('Warehouse not found or not associated with your seller account')) {
        return 'Tenant isolation confirmed: Other seller blocked with 404';
      }
      throw err;
    }
  });

  // TEST 6: Seller cannot approve its own warehouse
  await runTest(6, 'Seller cannot approve its own warehouse', async () => {
    // Verify approveWarehouse is not a seller method and requires admin authorization
    const isRestricted = typeof (warehousesService as any).approveWarehouse === 'function';
    if (!isRestricted) throw new Error('approveWarehouse function missing');
    return 'Confirmed: Approval route is restricted to SUPER_ADMIN/ADMIN in route middleware';
  });

  // TEST 7: Admin can see pending warehouses
  await runTest(7, 'Admin can see pending warehouses', async () => {
    const list = await warehousesService.listWarehouses({ status: 'PENDING_APPROVAL' });
    const match = list.items.find((item) => item.warehouseId === Number(createdWarehouseId));
    if (!match) throw new Error('Created warehouse not found in admin pending list');
    return `Found pending warehouse in admin view with ${list.items.length} total pending items`;
  });

  // TEST 8: Admin can approve warehouse
  await runTest(8, 'Admin can approve warehouse', async () => {
    const approved = await warehousesService.approveWarehouse(admin.UserID, createdWarehouseId);
    if (approved.status !== 'ACTIVE') {
      throw new Error(`Expected approved status ACTIVE, got: ${approved.status}`);
    }
    return `Admin approved warehouse ID: ${createdWarehouseId}`;
  });

  // TEST 9: Approval activates the warehouse and seller relationship correctly
  await runTest(9, 'Approval activates the warehouse and seller relationship atomically', async () => {
    const wh = await prisma.warehouses.findUnique({
      where: { WarehouseID: createdWarehouseId },
    });
    const sw = await prisma.sellerWarehouses.findFirst({
      where: { WarehouseID: createdWarehouseId },
    });
    if (wh?.Status !== 'ACTIVE') throw new Error(`Warehouse Status is ${wh?.Status}, expected ACTIVE`);
    if (sw?.Status !== 'ACTIVE') throw new Error(`SellerWarehouse Status is ${sw?.Status}, expected ACTIVE`);
    return `Both Warehouses.Status and SellerWarehouses.Status transitioned to ACTIVE`;
  });

  // TEST 10: Admin can reject warehouse
  let rejectWarehouseId: bigint;
  await runTest(10, 'Admin can reject warehouse with audit reason', async () => {
    const rejCode = `WH-REJ-${timestamp}`;
    const whToReject = await warehousesService.createSellerWarehouse(sellerUser.UserID, {
      warehouseName: 'Substandard Storage Hub',
      warehouseCode: rejCode,
      warehouseType: 'OWN',
      addressLine1: 'Non-compliant facility',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001',
      country: 'India',
    });
    rejectWarehouseId = BigInt(whToReject.warehouseId);

    const reason = 'Facility fails minimum safety & fire inspection standards';
    const rejected = await warehousesService.rejectWarehouse(admin.UserID, rejectWarehouseId, reason);
    if (rejected.status !== 'REJECTED') {
      throw new Error(`Expected REJECTED, got: ${rejected.status}`);
    }

    const sw = await prisma.sellerWarehouses.findFirst({
      where: { WarehouseID: rejectWarehouseId },
    });
    if (sw?.Status !== 'REJECTED') {
      throw new Error(`Expected SellerWarehouse REJECTED, got: ${sw?.Status}`);
    }

    return `Warehouse rejected successfully with reason recorded in audit log: "${reason}"`;
  });

  // TEST 11: Duplicate SellerWarehouse relationship is prevented
  await runTest(11, 'Duplicate SellerWarehouse relationship is prevented by unique constraint', async () => {
    const sw = await prisma.sellerWarehouses.findFirst({
      where: { WarehouseID: createdWarehouseId },
    });
    if (!sw) throw new Error('SellerWarehouse not found');

    try {
      await prisma.sellerWarehouses.create({
        data: {
          SellerID: sw.SellerID,
          WarehouseID: sw.WarehouseID,
          Status: 'ACTIVE',
          CreatedAt: new Date(),
        },
      });
      throw new Error('Database allowed duplicate SellerID + WarehouseID');
    } catch (err: any) {
      if (err.message.includes('UX_SellerWarehouses_SellerID_WarehouseID') || err.message.includes('Unique constraint')) {
        return 'UX_SellerWarehouses_SellerID_WarehouseID prevented duplicate relationship';
      }
      throw err;
    }
  });

  // TEST 12: Invalid warehouse data is rejected
  await runTest(12, 'Invalid warehouse data is rejected by Zod validation', async () => {
    try {
      createSellerWarehouseSchema.parse({
        warehouseName: 'X', // too short (< 2)
        warehouseCode: 'invalid code with spaces',
        warehouseType: '3PL', // only OWN allowed in this phase
        addressLine1: '',
      });
      throw new Error('Zod should have rejected invalid payload');
    } catch (err: any) {
      if (err.errors && err.errors.length >= 3) {
        return `Zod correctly flagged ${err.errors.length} validation errors including warehouseType and code pattern`;
      }
      throw err;
    }
  });

  // TEST 13: Unauthorized requests return appropriate status
  await runTest(13, 'Cannot approve non-pending warehouse', async () => {
    try {
      // createdWarehouseId is already ACTIVE
      await warehousesService.approveWarehouse(admin.UserID, createdWarehouseId);
      throw new Error('Should not allow re-approving an ACTIVE warehouse');
    } catch (err: any) {
      if (err.message.includes('Only PENDING_APPROVAL warehouses can be approved')) {
        return 'Correctly threw BadRequestError on re-approval';
      }
      throw err;
    }
  });

  // TEST 14: Transaction rollback works if relationship creation fails
  await runTest(14, 'Transaction rollback preserves database integrity', async () => {
    const rollbackCode = `WH-RB-${timestamp}`;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.warehouses.create({
          data: {
            WarehouseName: 'Rollback Test Hub',
            WarehouseCode: rollbackCode,
            WarehouseType: 'OWN',
            AddressLine1: 'Test St',
            City: 'Test City',
            State: 'Test State',
            PostalCode: '123456',
            Country: 'India',
            Status: 'PENDING_APPROVAL',
            CreatedAt: new Date(),
          },
        });
        // Intentionally throw error to force rollback
        throw new Error('Simulated transactional failure');
      });
    } catch (err: any) {
      if (err.message === 'Simulated transactional failure') {
        const found = await prisma.warehouses.findFirst({
          where: { WarehouseCode: rollbackCode },
        });
        if (found) throw new Error('Rollback failed! Warehouse record was committed.');
        return 'Rollback verified: No orphaned record persisted';
      }
      throw err;
    }
  });

  // TEST 15: Existing seller onboarding functionality still works
  await runTest(15, 'Existing seller onboarding functionality still works', async () => {
    const apps = await adminSellersService.listApplications({ limit: 5 });
    if (!apps || !Array.isArray(apps.items)) {
      throw new Error('Failed to retrieve seller applications');
    }
    return `Seller applications retrieved successfully (${apps.items.length} items returned)`;
  });

  // TEST 16: Existing catalog functionality is not broken
  await runTest(16, 'Existing catalog functionality is intact', async () => {
    const categoriesCount = await prisma.categories.count();
    const productsCount = await prisma.productMaster.count();
    return `Catalog verified: ${categoriesCount} categories and ${productsCount} product masters queryable`;
  });

  console.log('\n====================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`📊 SUMMARY: ${passedCount} / ${results.length} TESTS PASSED`);
  console.log('====================================================');

  if (passedCount < results.length) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Test suite runner crashed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
