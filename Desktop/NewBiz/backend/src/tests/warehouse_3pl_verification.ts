import { prisma } from '../database/prisma.js';
import { warehousesService } from '../modules/warehouses/warehouses.service.js';

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

async function ensureActiveSeller(email: string, sellerCode: string, businessName: string) {
  let user = await prisma.users.findFirst({ where: { Email: email } });
  if (!user) {
    user = await prisma.users.create({
      data: {
        FirstName: 'Test',
        LastName: sellerCode,
        Email: email,
        PhoneNumber: '98' + Math.floor(10000000 + Math.random() * 90000000),
        PasswordHash: 'hashed_password',
        Status: 'ACTIVE',
        CreatedAt: new Date(),
      },
    });
  }

  let sellerUser = await prisma.sellerUsers.findFirst({
    where: { UserID: user.UserID },
    include: { Sellers: true },
  });

  let seller: any;
  if (!sellerUser) {
    seller = await prisma.sellers.findFirst({ where: { SellerCode: sellerCode } });
    if (!seller) {
      seller = await prisma.sellers.create({
        data: {
          SellerCode: sellerCode,
          SellerName: `${sellerCode} Store`,
          BusinessName: businessName,
          Email: email,
          PhoneNumber: user.PhoneNumber,
          Status: 'ACTIVE',
          CreatedAt: new Date(),
        },
      });
    } else if (seller.Status !== 'ACTIVE') {
      seller = await prisma.sellers.update({
        where: { SellerID: seller.SellerID },
        data: { Status: 'ACTIVE' },
      });
    }

    await prisma.sellerUsers.create({
      data: {
        SellerID: seller.SellerID,
        UserID: user.UserID,
        Status: 'ACTIVE',
        CreatedAt: new Date(),
      },
    });
  } else {
    seller = sellerUser.Sellers;
    if (seller.Status !== 'ACTIVE') {
      seller = await prisma.sellers.update({
        where: { SellerID: seller.SellerID },
        data: { Status: 'ACTIVE' },
      });
    }
  }

  return { user, seller };
}

async function main() {
  console.log('================================================================');
  console.log('🚀 RUNNING 3PL PARTNER WAREHOUSES & MULTI-SELLER LINKAGE TEST SUITE');
  console.log('================================================================\n');

  // Setup admin & sellers
  const admin = await prisma.users.findFirst({ where: { Email: 'admin@test.com' } });
  if (!admin) throw new Error('Admin user admin@test.com not found');

  const seller1 = await ensureActiveSeller('seller@test.com', 'SELLER1', 'Seller One Logistics');
  const seller2 = await ensureActiveSeller('seller2_3pl@test.com', 'SELLER2_3PL', 'Seller Two Enterprises');
  const seller3 = await ensureActiveSeller('seller3_3pl@test.com', 'SELLER3_3PL', 'Seller Three Global');

  const timestamp = Date.now().toString().slice(-6);
  const warehouseCode = `3PL-HUB-${timestamp}`;
  let hubWarehouseId: bigint;
  let seller1LinkageId: bigint;
  let seller2LinkageId: bigint;
  let seller3LinkageId: bigint;

  // TEST 1: Admin can register a 3PL partner warehouse
  await runTest(1, 'Admin can register a 3PL partner warehouse', async () => {
    const hub = await warehousesService.createWarehouse(admin.UserID, {
      warehouseName: `Central 3PL Logistics Hub ${timestamp}`,
      warehouseCode,
      warehouseType: '3PL',
      addressLine1: 'Express Cargo Terminal 3, Air Cargo Road',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500108',
      country: 'India',
      contactPersonName: 'Rajesh Logistics Head',
      contactEmail: `hub_${timestamp}@express3pl.com`,
      contactPhoneNumber: '9988776655',
    });

    hubWarehouseId = BigInt(hub.warehouseId);
    if (hub.warehouseType !== '3PL') throw new Error(`Expected warehouseType 3PL, got ${hub.warehouseType}`);
    if (hub.status !== 'ACTIVE') throw new Error(`Expected status ACTIVE, got ${hub.status}`);

    return `Created 3PL Hub ID: ${hub.warehouseId}, Status: ${hub.status}, Type: ${hub.warehouseType}`;
  });

  // TEST 2: Seller can discover available 3PL hubs
  await runTest(2, 'Seller can list available 3PL hubs', async () => {
    const list = await warehousesService.listAvailable3PLWarehouses(seller1.user.UserID);
    const found = list.find((w) => w.warehouseId === Number(hubWarehouseId));
    if (!found) throw new Error('Created 3PL facility not found in available 3PL list');
    if (found.connectionStatus !== 'NOT_CONNECTED') {
      throw new Error(`Expected connectionStatus NOT_CONNECTED, got ${found.connectionStatus}`);
    }
    return `Found hub in available list with connectionStatus: ${found.connectionStatus}`;
  });

  // TEST 3: Seller 1 requests connection to 3PL hub
  await runTest(3, 'Seller 1 can request connection to 3PL hub (PENDING status)', async () => {
    const conn = await warehousesService.request3PLConnection(
      seller1.user.UserID,
      hubWarehouseId,
      true,
      'Integration request for seller 1'
    );
    seller1LinkageId = BigInt(conn.sellerWarehouseId);
    if (conn.relationshipStatus !== 'PENDING') {
      throw new Error(`Expected relationshipStatus PENDING, got ${conn.relationshipStatus}`);
    }
    if (!conn.isPrimary) {
      throw new Error('Expected isPrimary true');
    }
    return `Connection requested. SellerWarehouseID: ${conn.sellerWarehouseId}, Status: ${conn.relationshipStatus}`;
  });

  // TEST 4: Duplicate connection request is blocked
  await runTest(4, 'Duplicate connection request while PENDING is rejected', async () => {
    try {
      await warehousesService.request3PLConnection(seller1.user.UserID, hubWarehouseId);
      throw new Error('Should have failed with duplicate pending request');
    } catch (err: any) {
      if (err.message.includes('already pending review')) {
        return `Correctly blocked: ${err.message}`;
      }
      throw err;
    }
  });

  // TEST 5: Multi-Seller Linkage — Seller 2 connects to the same 3PL facility
  await runTest(5, 'Multi-seller linkage: Seller 2 can request connection to the same 3PL hub', async () => {
    const conn2 = await warehousesService.request3PLConnection(
      seller2.user.UserID,
      hubWarehouseId,
      false,
      'Integration request for seller 2'
    );
    seller2LinkageId = BigInt(conn2.sellerWarehouseId);
    if (conn2.relationshipStatus !== 'PENDING') {
      throw new Error(`Expected relationshipStatus PENDING, got ${conn2.relationshipStatus}`);
    }
    return `Seller 2 linked to same hub. SellerWarehouseID: ${conn2.sellerWarehouseId}`;
  });

  // TEST 6: Multi-tenant isolation between sellers
  await runTest(6, 'Multi-tenant isolation: Sellers only see their own warehouse records', async () => {
    const list1 = await warehousesService.listSellerWarehouses(seller1.user.UserID);
    const list2 = await warehousesService.listSellerWarehouses(seller2.user.UserID);

    const s1RecordInList1 = list1.find((w) => w.warehouseId === Number(hubWarehouseId));
    const s2RecordInList1 = list1.find((w) => w.sellerWarehouseId === Number(seller2LinkageId));
    const s2RecordInList2 = list2.find((w) => w.warehouseId === Number(hubWarehouseId));
    const s1RecordInList2 = list2.find((w) => w.sellerWarehouseId === Number(seller1LinkageId));

    if (!s1RecordInList1) throw new Error('Seller 1 should see their own 3PL linkage');
    if (s2RecordInList1) throw new Error('Seller 1 must NOT see Seller 2 linkage record');
    if (!s2RecordInList2) throw new Error('Seller 2 should see their own 3PL linkage');
    if (s1RecordInList2) throw new Error('Seller 2 must NOT see Seller 1 linkage record');

    return `Seller 1 count: ${list1.length}, Seller 2 count: ${list2.length} (Complete isolation verified)`;
  });

  // TEST 7: Admin reviews and approves Seller 1 linkage
  await runTest(7, 'Admin approves Seller 1 linkage request (transitions to ACTIVE)', async () => {
    const updatedWh = await warehousesService.reviewSellerLinkage(
      admin.UserID,
      seller1LinkageId,
      'APPROVE',
      'Authorized by marketplace operations'
    );

    const s1Link = updatedWh.associatedSellers?.find((s) => s.sellerId === Number(seller1.seller.SellerID));
    if (!s1Link || s1Link.relationshipStatus !== 'ACTIVE') {
      throw new Error(`Expected relationshipStatus ACTIVE, got ${s1Link?.relationshipStatus}`);
    }

    return `Approved Seller 1. Associated seller status: ${s1Link.relationshipStatus}`;
  });

  // TEST 8: Admin reviews and rejects Seller 2 linkage
  await runTest(8, 'Admin rejects Seller 2 linkage request (transitions to REJECTED)', async () => {
    const updatedWh = await warehousesService.reviewSellerLinkage(
      admin.UserID,
      seller2LinkageId,
      'REJECT',
      'Facility capacity exceeded'
    );

    const s2Link = updatedWh.associatedSellers?.find((s) => s.sellerId === Number(seller2.seller.SellerID));
    if (!s2Link || s2Link.relationshipStatus !== 'REJECTED') {
      throw new Error(`Expected relationshipStatus REJECTED, got ${s2Link?.relationshipStatus}`);
    }

    return `Rejected Seller 2. Associated seller status: ${s2Link.relationshipStatus}`;
  });

  // TEST 9: Admin directly links an active seller (Seller 3) to 3PL warehouse
  await runTest(9, 'Admin directly links Seller 3 to 3PL warehouse (immediately ACTIVE)', async () => {
    const updatedWh = await warehousesService.linkSellerTo3PLWarehouse(
      admin.UserID,
      seller3.seller.SellerID,
      hubWarehouseId,
      false
    );

    const s3Link = updatedWh.associatedSellers?.find((s) => s.sellerId === Number(seller3.seller.SellerID));
    if (!s3Link || s3Link.relationshipStatus !== 'ACTIVE') {
      throw new Error(`Expected relationshipStatus ACTIVE for directly linked seller, got ${s3Link?.relationshipStatus}`);
    }
    seller3LinkageId = BigInt(s3Link.sellerWarehouseId);

    return `Seller 3 directly linked. SellerWarehouseID: ${s3Link.sellerWarehouseId}, Status: ${s3Link.relationshipStatus}`;
  });

  // TEST 10: Database unique constraint UX_SellerWarehouses_SellerID_WarehouseID
  await runTest(10, 'Database unique constraint prevents duplicate linkage rows', async () => {
    try {
      await prisma.sellerWarehouses.create({
        data: {
          SellerID: seller1.seller.SellerID,
          WarehouseID: hubWarehouseId,
          Status: 'ACTIVE',
          IsPrimary: false,
          CreatedAt: new Date(),
        },
      });
      throw new Error('Database should have thrown unique constraint violation');
    } catch (err: any) {
      if (err.code === 'P2002' || err.message.includes('Unique constraint') || err.message.includes('UX_SellerWarehouses')) {
        return `Unique constraint confirmed: ${err.message.slice(0, 70)}...`;
      }
      throw err;
    }
  });

  // TEST 11: Seller 1 disconnects from 3PL hub
  await runTest(11, 'Seller can disconnect from 3PL hub (transitions to TERMINATED)', async () => {
    const res = await warehousesService.disconnect3PLWarehouse(seller1.user.UserID, hubWarehouseId);
    if (!res.success) throw new Error('Disconnect did not return success');

    const check = await prisma.sellerWarehouses.findUnique({
      where: { SellerWarehouseID: seller1LinkageId },
    });

    if (check?.Status !== 'TERMINATED') {
      throw new Error(`Expected TERMINATED status, got ${check?.Status}`);
    }

    return `Seller disconnected. Status: ${check.Status}, IsPrimary: ${check.IsPrimary}`;
  });

  // TEST 12: Admin unlinks Seller 3 from 3PL hub
  await runTest(12, 'Admin can unlink Seller 3 from 3PL facility', async () => {
    await warehousesService.unlinkSellerFromWarehouse(admin.UserID, seller3LinkageId);

    const check = await prisma.sellerWarehouses.findUnique({
      where: { SellerWarehouseID: seller3LinkageId },
    });

    if (check?.Status !== 'TERMINATED') {
      throw new Error(`Expected TERMINATED status, got ${check?.Status}`);
    }

    return `Admin unlinked seller. Status: ${check.Status}`;
  });

  // TEST 13: DataAuditLogs created for all operations
  await runTest(13, 'Audit logs recorded for 3PL lifecycle operations', async () => {
    const logs = await prisma.dataAuditLogs.findMany({
      where: {
        TableName: 'SellerWarehouses',
      },
      orderBy: { CreatedAt: 'desc' },
      take: 10,
    });

    if (logs.length === 0) throw new Error('No audit logs found for SellerWarehouses');

    const actions = logs.map((l) => {
      try {
        const d = JSON.parse(l.NewData || '{}');
        return d.action || l.ActionType;
      } catch {
        return l.ActionType;
      }
    });

    return `Found ${logs.length} recent audit entries. Actions: ${actions.join(', ')}`;
  });

  // TEST 14: WarehouseConsents recorded and queryable
  await runTest(14, 'WarehouseConsents recorded for 3PL lifecycle operations', async () => {
    const consents = await prisma.warehouseConsents.findMany({
      where: { WarehouseID: hubWarehouseId },
      orderBy: { CreatedAt: 'asc' },
    });

    if (consents.length === 0) {
      throw new Error('No WarehouseConsents found for 3PL warehouse');
    }

    const types = consents.map((c) => `${c.ConsentType}:${c.IsGranted ? 'GRANTED' : 'REVOKED'}`);
    return `Found ${consents.length} consent records: ${types.join(', ')}`;
  });

  // Summary
  console.log('\n================================================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('================================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error('\nFailed tests:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- Test ${r.num}: ${r.description} -> ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 13/13 3PL PARTNER WAREHOUSE & MULTI-SELLER LINKAGE TESTS PASSED!\n');
    process.exit(0);
  }
}

main()
  .catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
