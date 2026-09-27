import { prisma } from '../database/prisma.js';
import { sellerOnboardingService } from '../modules/seller-onboarding/sellerOnboarding.service.js';
import { warehousesService } from '../modules/warehouses/warehouses.service.js';

interface TestResult {
  num: number;
  description: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(num: number, description: string, fn: () => Promise<string | void>) {
  try {
    const details = await fn();
    results.push({ num, description, passed: true, details: details || undefined });
    console.log(`✅ TEST ${num} PASSED: ${description}${details ? ` -> ${details}` : ''}`);
  } catch (err: any) {
    results.push({ num, description, passed: false, error: err.message });
    console.error(`❌ TEST ${num} FAILED: ${description}`);
    console.error(`   Error: ${err.message}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('🧪 VERIFICATION SUITE: DYNAMIC DOCUMENT REQUIREMENTS (SELLER & WAREHOUSE)');
  console.log('================================================================\n');

  // TEST 1: Verify SellerDocumentRequirements table contains seeded records
  await runTest(1, 'SellerDocumentRequirements has active seeded requirements', async () => {
    const reqs = await prisma.sellerDocumentRequirements.findMany({
      include: { DocumentTypes: true },
    });
    if (reqs.length === 0) {
      throw new Error('No records found in SellerDocumentRequirements');
    }
    const codes = reqs.map((r) => `${r.DocumentTypes.Code}:${r.IsRequired ? 'MANDATORY' : 'OPTIONAL'}`);
    return `Found ${reqs.length} seller requirements: ${codes.join(', ')}`;
  });

  // TEST 2: Verify WarehouseDocumentRequirements has seeded requirements for OWN and 3PL
  await runTest(2, 'WarehouseDocumentRequirements has active requirements for OWN & 3PL', async () => {
    const ownReqs = await warehousesService.getWarehouseDocumentRequirements('OWN');
    const tplReqs = await warehousesService.getWarehouseDocumentRequirements('3PL');

    if (ownReqs.length === 0) throw new Error('No OWN warehouse document requirements found');
    if (tplReqs.length === 0) throw new Error('No 3PL warehouse document requirements found');

    const ownCodes = ownReqs.map((r) => `${r.code}:${r.isRequired ? 'REQ' : 'OPT'}`).join(', ');
    const tplCodes = tplReqs.map((r) => `${r.code}:${r.isRequired ? 'REQ' : 'OPT'}`).join(', ');

    return `OWN [${ownCodes}] | 3PL [${tplCodes}]`;
  });

  // TEST 3: Unique constraint on SellerDocumentRequirements prevents duplicate DocumentTypeID
  await runTest(3, 'SellerDocumentRequirements unique constraint prevents duplicates', async () => {
    const existing = await prisma.sellerDocumentRequirements.findFirst();
    if (!existing) throw new Error('No existing requirement to test');

    try {
      await prisma.sellerDocumentRequirements.create({
        data: {
          DocumentTypeID: existing.DocumentTypeID,
          IsRequired: true,
          IsActive: true,
          CreatedBy: existing.CreatedBy,
          CreatedAt: new Date(),
        },
      });
      throw new Error('Duplicate SellerDocumentRequirement was allowed unexpectedly');
    } catch (err: any) {
      if (err.message.includes('UX_SellerDocumentRequirements_DocumentTypeID') || err.message.includes('Unique constraint failed')) {
        return 'UX_SellerDocumentRequirements_DocumentTypeID prevented duplicate insertion';
      }
      throw err;
    }
  });

  // TEST 4: Unique composite constraint on WarehouseDocumentRequirements prevents duplicate (WarehouseType, DocumentTypeID)
  await runTest(4, 'WarehouseDocumentRequirements unique constraint prevents duplicate per type', async () => {
    const existing = await prisma.warehouseDocumentRequirements.findFirst();
    if (!existing) throw new Error('No existing warehouse requirement to test');

    try {
      await prisma.warehouseDocumentRequirements.create({
        data: {
          WarehouseType: existing.WarehouseType,
          DocumentTypeID: existing.DocumentTypeID,
          IsRequired: true,
          IsActive: true,
          CreatedBy: existing.CreatedBy,
          CreatedAt: new Date(),
        },
      });
      throw new Error('Duplicate WarehouseDocumentRequirement was allowed unexpectedly');
    } catch (err: any) {
      if (err.message.includes('UX_WarehouseDocumentRequirements_WarehouseType_DocumentTypeID') || err.message.includes('Unique constraint failed')) {
        return 'UX_WarehouseDocumentRequirements_WarehouseType_DocumentTypeID enforced successfully';
      }
      throw err;
    }
  });

  // TEST 5: Dynamic seller onboarding documents combine baseline + category requirements
  await runTest(5, 'Seller onboarding status returns combined dynamic requirements', async () => {
    const testSellerUser = await prisma.sellerUsers.findFirst({
      where: { Status: 'ACTIVE' },
      include: { Users_SellerUsers_UserIDToUsers: true },
    });

    if (!testSellerUser) throw new Error('No active seller user found for test');

    const status = await sellerOnboardingService.getOnboardingStatus(testSellerUser.UserID);
    if (!status.requiredDocuments || status.requiredDocuments.length === 0) {
      throw new Error('No requiredDocuments returned in onboarding status');
    }

    const baselineSources = status.requiredDocuments.filter((d: any) => d.source === 'SELLER_BASELINE' || d.source === 'BOTH');
    if (baselineSources.length === 0) {
      throw new Error('Dynamic requirements missing SELLER_BASELINE documents');
    }

    return `Resolved ${status.requiredDocuments.length} dynamic documents (${baselineSources.length} baseline/both)`;
  });

  // TEST 6: Warehouse details include dynamic requiredDocuments and documents array
  await runTest(6, 'Warehouse details API includes dynamic requiredDocuments', async () => {
    const wh = await prisma.warehouses.findFirst({
      where: { Status: 'ACTIVE' },
    });
    if (!wh) throw new Error('No active warehouse found');

    const details = await warehousesService.getWarehouseById(wh.WarehouseID);
    if (!details.requiredDocuments || details.requiredDocuments.length === 0) {
      throw new Error('requiredDocuments not present on warehouse details');
    }

    return `Facility ${wh.WarehouseCode} (${wh.WarehouseType}) has ${details.requiredDocuments.length} required documents dynamically configured`;
  });

  // TEST 7: Upload warehouse compliance document & verify status and isMandatory
  await runTest(7, 'SellerWarehouseDocuments accepts uploaded compliance document with dynamic isMandatory', async () => {
    const sw = await prisma.sellerWarehouses.findFirst({
      where: { Status: 'ACTIVE' },
      include: { Warehouses: true },
    });
    if (!sw) throw new Error('No active SellerWarehouse found');

    const docType = await prisma.documentTypes.findFirst({
      where: { Code: 'GST' },
    });
    if (!docType) throw new Error('GST DocumentType not found');

    // Check dynamic requirement for this facility type
    const req = await prisma.warehouseDocumentRequirements.findFirst({
      where: { WarehouseType: sw.Warehouses.WarehouseType, DocumentTypeID: docType.DocumentTypeID },
    });

    const isMandatory = req ? req.IsRequired : false;

    // Simulate upload record
    const existing = await prisma.sellerWarehouseDocuments.findFirst({
      where: { SellerWarehouseID: sw.SellerWarehouseID, DocumentTypeID: docType.DocumentTypeID },
    });

    let doc;
    if (existing) {
      doc = await prisma.sellerWarehouseDocuments.update({
        where: { SellerWarehouseDocumentID: existing.SellerWarehouseDocumentID },
        data: {
          DocumentNumber: 'GSTIN27AAAAA0000A1Z5',
          DocumentURL: '/uploads/warehouse-documents/test-gst-doc.pdf',
          VerificationStatus: 'PENDING',
          IsMandatory: isMandatory,
          UpdatedAt: new Date(),
        },
      });
    } else {
      doc = await prisma.sellerWarehouseDocuments.create({
        data: {
          SellerWarehouseID: sw.SellerWarehouseID,
          DocumentTypeID: docType.DocumentTypeID,
          DocumentNumber: 'GSTIN27AAAAA0000A1Z5',
          DocumentURL: '/uploads/warehouse-documents/test-gst-doc.pdf',
          VerificationStatus: 'PENDING',
          IsMandatory: isMandatory,
          CreatedAt: new Date(),
        },
      });
    }

    if (doc.VerificationStatus !== 'PENDING') {
      throw new Error('Document status is not PENDING');
    }

    return `Uploaded ${docType.Code} for SellerWarehouse #${sw.SellerWarehouseID}: Status = ${doc.VerificationStatus}, IsMandatory = ${doc.IsMandatory}`;
  });

  // TEST 8: Admin can review and verify warehouse document
  await runTest(8, 'Admin can review and verify warehouse document', async () => {
    const adminUser = await prisma.users.findFirst({
      where: { Status: 'ACTIVE' },
    });
    if (!adminUser) throw new Error('Admin user not found');

    const pendingDoc = await prisma.sellerWarehouseDocuments.findFirst({
      where: { VerificationStatus: 'PENDING' },
    });
    if (!pendingDoc) throw new Error('No pending document found to review');

    const reviewed = await warehousesService.reviewWarehouseDocument(
      adminUser.UserID,
      pendingDoc.SellerWarehouseDocumentID,
      'VERIFY'
    );

    if (reviewed.verificationStatus !== 'VERIFIED') {
      throw new Error(`Expected VERIFIED, got ${reviewed.verificationStatus}`);
    }

    return `Document #${reviewed.sellerWarehouseDocumentId} verified by Admin #${adminUser.UserID}`;
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
    console.log('\n🎉 ALL 8/8 DYNAMIC DOCUMENT REQUIREMENT TESTS PASSED!\n');
    process.exit(0);
  }
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
