import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Document Types
  const documentTypesData = [
    { Code: 'GST', DisplayName: 'GST Registration Certificate', Status: 'ACTIVE' },
    { Code: 'FSSAI', DisplayName: 'FSSAI Food Safety License', Status: 'ACTIVE' },
    { Code: 'PAN', DisplayName: 'Business / Individual PAN Card', Status: 'ACTIVE' },
    { Code: 'BANK_PROOF', DisplayName: 'Bank Account Proof (Cancelled Cheque)', Status: 'ACTIVE' },
    { Code: 'BIS_CERT', DisplayName: 'Bureau of Indian Standards (BIS) Certificate', Status: 'ACTIVE' },
    { Code: 'MFG_AUTH', DisplayName: 'Manufacturer / Brand Authorization Letter', Status: 'ACTIVE' },
    { Code: 'APOB_VPOB', DisplayName: 'GST APOB / VPOB Registration', Status: 'ACTIVE' },
    { Code: 'WH_AGREEMENT', DisplayName: 'Warehouse / 3PL Service Agreement', Status: 'ACTIVE' },
  ];

  for (const doc of documentTypesData) {
    const existing = await prisma.documentTypes.findFirst({ where: { Code: doc.Code } });
    if (!existing) {
      await prisma.documentTypes.create({ data: doc });
      console.log(` Created DocumentType: ${doc.Code}`);
    }
  }

  // 2. Seed Roles
  const rolesData = [
    { RoleName: 'SUPER_ADMIN', Description: 'Full platform super administrator', Status: 'ACTIVE' },
    { RoleName: 'ADMIN', Description: 'Platform operations administrator', Status: 'ACTIVE' },
    { RoleName: 'SELLER_USER', Description: 'Merchant / Seller portal user', Status: 'ACTIVE' },
    { RoleName: 'WAREHOUSE_USER', Description: 'Warehouse / WMS staff user', Status: 'ACTIVE' },
  ];

  const roleMap = new Map<string, number>();
  for (const r of rolesData) {
    let role = await prisma.roles.findFirst({ where: { RoleName: r.RoleName } });
    if (!role) {
      role = await prisma.roles.create({
        data: {
          RoleName: r.RoleName,
          Description: r.Description,
          Status: r.Status,
          CreatedAt: new Date(),
        },
      });
      console.log(` Created Role: ${r.RoleName}`);
    }
    roleMap.set(r.RoleName, role.RoleID);
  }

  // 3. Seed Permissions
  const permissionsData = [
    // Users & Roles
    { PermissionCode: 'users.read', PermissionName: 'View Users', Description: 'Can view user accounts' },
    { PermissionCode: 'users.manage', PermissionName: 'Manage Users', Description: 'Can create and edit users' },
    { PermissionCode: 'roles.manage', PermissionName: 'Manage Roles', Description: 'Can assign roles and permissions' },
    // Sellers & Onboarding
    { PermissionCode: 'sellers.read', PermissionName: 'View Sellers', Description: 'Can view seller profiles' },
    { PermissionCode: 'sellers.manage', PermissionName: 'Manage Sellers', Description: 'Can create or update sellers' },
    { PermissionCode: 'applications.review', PermissionName: 'Review Applications', Description: 'Can verify documents and approve/reject applications' },
    // Warehouses
    { PermissionCode: 'warehouses.read', PermissionName: 'View Warehouses', Description: 'Can view warehouse details' },
    { PermissionCode: 'warehouses.manage', PermissionName: 'Manage Warehouses', Description: 'Can create and configure warehouses' },
    // Catalog
    { PermissionCode: 'catalog.read', PermissionName: 'View Catalog', Description: 'Can view products, brands, categories' },
    { PermissionCode: 'catalog.manage', PermissionName: 'Manage Catalog', Description: 'Can create and edit catalog items' },
    // Inventory
    { PermissionCode: 'inventory.read', PermissionName: 'View Inventory', Description: 'Can view stock levels' },
    { PermissionCode: 'inventory.manage', PermissionName: 'Manage Inventory', Description: 'Can adjust inventory and log transactions' },
    // OMS & Fulfillment
    { PermissionCode: 'orders.read', PermissionName: 'View Orders', Description: 'Can view customer/seller orders' },
    { PermissionCode: 'fulfillments.manage', PermissionName: 'Manage Fulfillments', Description: 'Can process pick, pack, and shipments' },
  ];

  const permissionIds: number[] = [];
  for (const p of permissionsData) {
    let perm = await prisma.permissions.findFirst({ where: { PermissionCode: p.PermissionCode } });
    if (!perm) {
      perm = await prisma.permissions.create({
        data: {
          PermissionCode: p.PermissionCode,
          PermissionName: p.PermissionName,
          Description: p.Description,
          CreatedAt: new Date(),
        },
      });
      console.log(` Created Permission: ${p.PermissionCode}`);
    }
    permissionIds.push(perm.PermissionID);
  }

  // Assign all permissions to SUPER_ADMIN
  const superAdminRoleId = roleMap.get('SUPER_ADMIN');
  if (superAdminRoleId) {
    for (const pid of permissionIds) {
      const existingRP = await prisma.rolePermissions.findFirst({
        where: { RoleID: superAdminRoleId, PermissionID: pid },
      });
      if (!existingRP) {
        await prisma.rolePermissions.create({
          data: {
            RoleID: superAdminRoleId,
            PermissionID: pid,
            CreatedAt: new Date(),
          },
        });
      }
    }
    console.log(' Configured SUPER_ADMIN RolePermissions');
  }

  // 4. Seed Default Admin User
  // 4. Seed Default Admin User (Simple test credentials)
  const adminEmail = 'admin@test.com';
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  let adminUser = await prisma.users.findFirst({ where: { Email: adminEmail } });

  if (!adminUser) {
    adminUser = await prisma.users.create({
      data: {
        FirstName: 'Super',
        LastName: 'Admin',
        Email: adminEmail,
        PhoneNumber: '9999999999',
        PasswordHash: adminPasswordHash,
        Status: 'ACTIVE',
        CreatedAt: new Date(),
      },
    });
    console.log(` Created Admin User: ${adminEmail} (password: admin123)`);
  } else {
    await prisma.users.update({
      where: { UserID: adminUser.UserID },
      data: { PasswordHash: adminPasswordHash },
    });
    console.log(` Updated Admin User: ${adminEmail} (password: admin123)`);
  }

  if (superAdminRoleId && adminUser) {
    const existingUR = await prisma.userRoles.findFirst({
      where: { UserID: adminUser.UserID, RoleID: superAdminRoleId },
    });
    if (!existingUR) {
      await prisma.userRoles.create({
        data: {
          UserID: adminUser.UserID,
          RoleID: superAdminRoleId,
          CreatedAt: new Date(),
        },
      });
      console.log(' Assigned SUPER_ADMIN role to admin user');
    }
  }

  // 5. Seed Sample Seller User (Simple test credentials, linked to SEL001 - KitchenKart)
  const sellerEmail = 'seller@test.com';
  const sellerPasswordHash = await bcrypt.hash('seller123', 10);
  let sellerUser = await prisma.users.findFirst({ where: { Email: sellerEmail } });

  if (!sellerUser) {
    sellerUser = await prisma.users.create({
      data: {
        FirstName: 'Test',
        LastName: 'Seller',
        Email: sellerEmail,
        PhoneNumber: '9876500001',
        PasswordHash: sellerPasswordHash,
        Status: 'ACTIVE',
        CreatedAt: new Date(),
      },
    });
    console.log(` Created Seller User: ${sellerEmail} (password: seller123)`);
  } else {
    await prisma.users.update({
      where: { UserID: sellerUser.UserID },
      data: { PasswordHash: sellerPasswordHash },
    });
    console.log(` Updated Seller User: ${sellerEmail} (password: seller123)`);
  }

  const sellerRoleID = roleMap.get('SELLER_USER');
  if (sellerRoleID && sellerUser) {
    const existingUR = await prisma.userRoles.findFirst({
      where: { UserID: sellerUser.UserID, RoleID: sellerRoleID },
    });
    if (!existingUR) {
      await prisma.userRoles.create({
        data: { UserID: sellerUser.UserID, RoleID: sellerRoleID, CreatedAt: new Date() },
      });
    }

    const sellerRecord = await prisma.sellers.findFirst({ where: { SellerCode: 'SEL001' } });
    if (sellerRecord) {
      const existingSU = await prisma.sellerUsers.findFirst({
        where: { SellerID: sellerRecord.SellerID, UserID: sellerUser.UserID },
      });
      if (!existingSU) {
        await prisma.sellerUsers.create({
          data: {
            SellerID: sellerRecord.SellerID,
            UserID: sellerUser.UserID,
            Status: 'ACTIVE',
            CreatedAt: new Date(),
          },
        });
        console.log(` Linked seller user ${sellerEmail} to Seller SEL001`);
      }
    }
  }

  // 6. Seed Sample Warehouse User (Simple test credentials, linked to WH-HYD-01)
  const whEmail = 'warehouse@test.com';
  const whPasswordHash = await bcrypt.hash('warehouse123', 10);
  let whUser = await prisma.users.findFirst({ where: { Email: whEmail } });

  if (!whUser) {
    whUser = await prisma.users.create({
      data: {
        FirstName: 'Test',
        LastName: 'Warehouse',
        Email: whEmail,
        PhoneNumber: '9000000001',
        PasswordHash: whPasswordHash,
        Status: 'ACTIVE',
        CreatedAt: new Date(),
      },
    });
    console.log(` Created Warehouse User: ${whEmail} (password: warehouse123)`);
  } else {
    await prisma.users.update({
      where: { UserID: whUser.UserID },
      data: { PasswordHash: whPasswordHash },
    });
    console.log(` Updated Warehouse User: ${whEmail} (password: warehouse123)`);
  }

  const whRoleID = roleMap.get('WAREHOUSE_USER');
  if (whRoleID && whUser) {
    const existingUR = await prisma.userRoles.findFirst({
      where: { UserID: whUser.UserID, RoleID: whRoleID },
    });
    if (!existingUR) {
      await prisma.userRoles.create({
        data: { UserID: whUser.UserID, RoleID: whRoleID, CreatedAt: new Date() },
      });
    }

    const whRecord = await prisma.warehouses.findFirst({ where: { WarehouseCode: 'WH-HYD-01' } });
    if (whRecord) {
      const existingWU = await prisma.warehouseUsers.findFirst({
        where: { WarehouseID: whRecord.WarehouseID, UserID: whUser.UserID },
      });
      if (!existingWU) {
        await prisma.warehouseUsers.create({
          data: {
            WarehouseID: whRecord.WarehouseID,
            UserID: whUser.UserID,
            Status: 'ACTIVE',
            CreatedAt: new Date(),
          },
        });
        console.log(` Linked warehouse user ${whEmail} to Warehouse WH-HYD-01`);
      }
    }
  }

  // 7. Seed Category Document Requirements for Leaf Categories
  const docTypesMap = new Map<string, number>();
  const allDocTypes = await prisma.documentTypes.findMany();
  for (const d of allDocTypes) {
    docTypesMap.set(d.Code, d.DocumentTypeID);
  }

  // Define leaf category compliance matrix
  const leafCategoryRequirements: Record<string, Array<{ code: string; mandatory: boolean }>> = {
    'Pressure Cookers': [
      { code: 'GST', mandatory: true },
      { code: 'PAN', mandatory: true },
      { code: 'BANK_PROOF', mandatory: true },
      { code: 'BIS_CERT', mandatory: true },
    ],
    'Fry Pans': [
      { code: 'GST', mandatory: true },
      { code: 'PAN', mandatory: true },
      { code: 'BANK_PROOF', mandatory: true },
    ],
    'Choppers': [
      { code: 'GST', mandatory: true },
      { code: 'PAN', mandatory: true },
      { code: 'BANK_PROOF', mandatory: true },
      { code: 'MFG_AUTH', mandatory: true },
    ],
    'Storage Containers': [
      { code: 'GST', mandatory: true },
      { code: 'PAN', mandatory: true },
      { code: 'BANK_PROOF', mandatory: true },
    ],
    'Bathroom Organizers': [
      { code: 'GST', mandatory: true },
      { code: 'PAN', mandatory: true },
      { code: 'BANK_PROOF', mandatory: true },
    ],
  };

  for (const [catName, reqs] of Object.entries(leafCategoryRequirements)) {
    const leafCat = await prisma.categories.findFirst({ where: { CategoryName: catName } });
    if (!leafCat) continue;

    for (const req of reqs) {
      const docTypeId = docTypesMap.get(req.code);
      if (!docTypeId) continue;

      const existingCD = await prisma.categoryDocuments.findFirst({
        where: { CategoryID: leafCat.CategoryID, DocumentTypeID: docTypeId },
      });

      if (!existingCD) {
        await prisma.categoryDocuments.create({
          data: {
            CategoryID: leafCat.CategoryID,
            DocumentTypeID: docTypeId,
            IsMandatory: req.mandatory,
            Status: 'ACTIVE',
            CreatedAt: new Date(),
          },
        });
      }
    }
    console.log(` Configured leaf category documents for: ${catName}`);
  }

  // 10. Seed Baseline SellerDocumentRequirements
  const adminUserId = adminUser.UserID;
  const sellerReqsData = [
    { code: 'GST', isRequired: true, isActive: true },
    { code: 'PAN', isRequired: true, isActive: true },
    { code: 'BANK_PROOF', isRequired: true, isActive: true },
    { code: 'FSSAI', isRequired: false, isActive: true },
    { code: 'BIS_CERT', isRequired: false, isActive: true },
    { code: 'MFG_AUTH', isRequired: false, isActive: true },
  ];

  for (const sReq of sellerReqsData) {
    const docTypeId = docTypesMap.get(sReq.code);
    if (!docTypeId) continue;

    const existing = await prisma.sellerDocumentRequirements.findFirst({
      where: { DocumentTypeID: docTypeId },
    });

    if (!existing) {
      await prisma.sellerDocumentRequirements.create({
        data: {
          DocumentTypeID: docTypeId,
          IsRequired: sReq.isRequired,
          IsActive: sReq.isActive,
          CreatedBy: adminUserId,
          CreatedAt: new Date(),
        },
      });
      console.log(` Configured SellerDocumentRequirement: ${sReq.code} (Required: ${sReq.isRequired})`);
    }
  }

  // 11. Seed Baseline WarehouseDocumentRequirements
  const warehouseReqsData = [
    // OWN (Seller-Operated) Warehouse requirements
    { warehouseType: 'OWN', code: 'APOB_VPOB', isRequired: true, isActive: true },
    { warehouseType: 'OWN', code: 'GST', isRequired: true, isActive: true },
    { warehouseType: 'OWN', code: 'WH_AGREEMENT', isRequired: false, isActive: true },
    // 3PL Partner Warehouse requirements
    { warehouseType: '3PL', code: 'WH_AGREEMENT', isRequired: true, isActive: true },
    { warehouseType: '3PL', code: 'APOB_VPOB', isRequired: true, isActive: true },
    { warehouseType: '3PL', code: 'GST', isRequired: true, isActive: true },
  ];

  for (const whReq of warehouseReqsData) {
    const docTypeId = docTypesMap.get(whReq.code);
    if (!docTypeId) continue;

    const existing = await prisma.warehouseDocumentRequirements.findFirst({
      where: {
        WarehouseType: whReq.warehouseType,
        DocumentTypeID: docTypeId,
      },
    });

    if (!existing) {
      await prisma.warehouseDocumentRequirements.create({
        data: {
          WarehouseType: whReq.warehouseType,
          DocumentTypeID: docTypeId,
          IsRequired: whReq.isRequired,
          IsActive: whReq.isActive,
          CreatedBy: adminUserId,
          CreatedAt: new Date(),
        },
      });
      console.log(` Configured WarehouseDocumentRequirement: [${whReq.warehouseType}] ${whReq.code} (Required: ${whReq.isRequired})`);
    }
  }

  // 12. Seed Baseline CMS Pages, FAQs, Contact Info & Social Links
  console.log('📄 Seeding baseline CMS Pages & Policies...');
  const cmsPagesData = [
    {
      pageType: 'ABOUT_US',
      title: 'About Our Brand',
      slug: 'about-us',
      metaTitle: 'About AURA | Conscious Craft & Timeless Design',
      metaDescription: 'Learn about AURA founding story, sustainable craftsmanship, and architectural approach to modern commerce.',
      content: `<h2>An Architectural Approach to Modern Commerce</h2>
<p>Founded with an obsessive dedication to materiality and functional minimalism, <strong>AURA</strong> curates exceptional goods designed to elevate your everyday rituals. From precision-machined desk accessories to sustainably woven organic textiles, every object in our catalog balances rigorous aesthetics with everyday durability.</p>
<h3>Our Founding Ethos</h3>
<ul>
  <li><strong>Radical Material Purity:</strong> We source solely circular, responsibly harvested materials, from Grade-5 titanium to GOTS-certified organic cotton.</li>
  <li><strong>Direct Artisan Partnerships:</strong> Eliminating distributor layers lets us compensate master fabricators equitably while offering uncompromising value.</li>
  <li><strong>Zero-Obsolescence Guarantee:</strong> Designed to outlast seasonal trends, supported by our comprehensive warranty and repair programs.</li>
</ul>
<h3>Carbon Neutral Commitment</h3>
<p>Every shipment is 100% carbon-offset from our fulfillment center to your door. We utilize recycled ocean-bound plastics for packaging and partner with international reforestation initiatives.</p>`,
    },
    {
      pageType: 'RETURN_POLICY',
      title: '30-Day Hassle-Free Returns & Refunds',
      slug: 'return-policy',
      metaTitle: '30-Day Return & Refund Policy | AURA',
      metaDescription: 'Read our comprehensive return policy. 30 days hassle-free returns with prepaid shipping and rapid refunds.',
      content: `<h2>Our 30-Day Happiness Guarantee</h2>
<p>We want you to be entirely delighted with every AURA purchase. If a product does not seamlessly complement your life, return it within <strong>30 days of delivery</strong> for a prompt refund or store credit.</p>
<h3>Eligibility Checklist</h3>
<ul>
  <li>Item is in original, undamaged condition with all tags and protective sleeves attached.</li>
  <li>Includes original brand box, manuals, and accessories.</li>
  <li>For beauty & wellness items, inner security seals must remain unbroken.</li>
</ul>
<h3>4-Step Return Process</h3>
<ol>
  <li><strong>Initiate Request:</strong> Visit the <a href="/contact">Concierge page</a> or click <em>Track Order</em> to generate a prepaid return shipping label.</li>
  <li><strong>Safe Packaging:</strong> Repack the item safely using the original shipping box or equivalent protective packaging.</li>
  <li><strong>Courier Hand-off:</strong> Drop the package at any authorized courier terminal or schedule a doorstep pickup.</li>
  <li><strong>Rapid Refund:</strong> Once inspected at our hub (typically 48 hours), your refund will be credited to your original payment method in 3–5 business days.</li>
</ol>`,
    },
    {
      pageType: 'CAREERS',
      title: 'Careers & Creative Horizons',
      slug: 'careers',
      metaTitle: 'Careers at AURA | Join Our Design & Tech Team',
      metaDescription: 'Explore open career opportunities at AURA. We build mindful commerce experiences with competitive compensation.',
      content: `<h2>Build the Future of Mindful Commerce</h2>
<p>At AURA, we bring together architects, industrial designers, software craftspeople, and supply chain visionaries. We are united by a passion for quality, craftsmanship, and elegant digital experiences.</p>
<h3>Why Thrive at AURA?</h3>
<ul>
  <li><strong>Distributed First:</strong> Collaborate from wherever you do your most focused, inspired work with generous home-studio stipends.</li>
  <li><strong>Comprehensive Well-being:</strong> 100% premium health, dental, and optical coverage, plus quarterly wellness allowances.</li>
  <li><strong>Continuous Learning:</strong> Annual education and conference budget ($2,500) dedicated to your personal growth.</li>
  <li><strong>Generous Equity & Compensation:</strong> Competitive tier-1 salaries accompanied by meaningful early-team equity participation.</li>
</ul>
<h3>Active Horizons</h3>
<p>We are currently welcoming talent in <strong>Senior Frontend Engineering (React/TypeScript)</strong>, <strong>Supply Chain Optimization</strong>, and <strong>Visual Brand Design</strong>. Inquire with your portfolio at <a href="mailto:careers@aura-commerce.com">careers@aura-commerce.com</a>.</p>`,
    },
    {
      pageType: 'PRIVACY_POLICY',
      title: 'Privacy & Data Protection Policy',
      slug: 'privacy-policy',
      metaTitle: 'Privacy Policy | AURA Data Security & Compliance',
      metaDescription: 'How AURA collects, protects, and respects your personal information in compliance with international privacy laws.',
      content: `<h2>Your Privacy is Sacred</h2>
<p>This Privacy Policy explains how AURA ("we", "our", or "us") collects, utilizes, and protects your personal information when browsing our storefront or completing transactions.</p>
<h3>1. Information We Collect</h3>
<ul>
  <li><strong>Identity & Contact Details:</strong> Name, billing/shipping address, email address, and telephone number.</li>
  <li><strong>Transaction History:</strong> Products ordered, order amounts, and payment status (handled securely via PCI-DSS certified processors).</li>
  <li><strong>Technical Telemetry:</strong> Anonymized browser version, device category, and IP location for fraud prevention and performance optimization.</li>
</ul>
<h3>2. How We Protect Your Data</h3>
<p>We enforce end-to-end TLS 1.3 encryption on all data in transit and hardware-encrypted storage at rest. <strong>We do not sell, rent, or trade your personal information to third-party data brokers under any circumstances.</strong></p>
<h3>3. Your Statutory Rights</h3>
<p>Under GDPR and CCPA, you retain the unconditional right to access, rectify, or demand erasure of your personal data at any time. Simply email <a href="mailto:privacy@aura-commerce.com">privacy@aura-commerce.com</a> to exercise your rights.</p>`,
    },
    {
      pageType: 'TERMS_OF_SERVICE',
      title: 'Terms of Service',
      slug: 'terms-of-service',
      metaTitle: 'Terms of Service | AURA Commerce Terms & Conditions',
      metaDescription: 'Review the terms and conditions governing the use of AURA storefront, transactions, accounts, and fulfillment.',
      content: `<h2>Terms of Service Agreement</h2>
<p>Welcome to AURA. By accessing our platform, creating a customer account, or purchasing merchandise, you agree to abide by these Terms of Service.</p>
<h3>1. Account Integrity</h3>
<p>You agree to provide true, accurate, and current contact information during checkout or account registration and to maintain the confidentiality of your authentication credentials.</p>
<h3>2. Pricing, Errors & Order Confirmation</h3>
<p>All prices displayed are subject to applicable taxes and standard carrier shipping rates unless otherwise stated. While we make every effort to avoid inaccuracies, we reserve the right to cancel orders arising from obvious clerical or pricing glitches.</p>
<h3>3. Intellectual Property</h3>
<p>All designs, high-fidelity imagery, typography, audio clips, and proprietary codebases belong exclusively to AURA Commerce Inc. and may not be reproduced without prior written consent.</p>`,
    },
    {
      pageType: 'COOKIE_POLICY',
      title: 'Cookie & Tracking Technology Policy',
      slug: 'cookie-policy',
      metaTitle: 'Cookie Policy | AURA Transparency & Preferences',
      metaDescription: 'Understand what cookies AURA uses, how they optimize your shopping experience, and how to control your preferences.',
      content: `<h2>Understanding Cookies at AURA</h2>
<p>Cookies and local storage tokens are small text fragments stored on your device that enable our storefront to remember your preferences and deliver smooth interactions.</p>
<h3>Cookie Categories We Employ</h3>
<ul>
  <li><strong>Strictly Necessary Cookies:</strong> Essential for secure session authentication, shopping bag persistence, and checkout navigation. Cannot be deactivated.</li>
  <li><strong>Functional & Preference Cookies:</strong> Remembers your chosen currency, localization, and saved wishlist items.</li>
  <li><strong>Analytics & Performance Cookies:</strong> Gathers aggregated, anonymized metrics on page load times and user journeys to refine platform performance.</li>
</ul>
<p>You can adjust or revoke your cookie consent at any moment via the <strong>Cookie Settings</strong> button located in our website footer.</p>`,
    },
    {
      pageType: 'SHIPPING_POLICY',
      title: 'Shipping & Express Delivery',
      slug: 'shipping-policy',
      metaTitle: 'Shipping & Express Delivery | AURA Worldwide Logistics',
      metaDescription: 'Information on standard, expedited, and international delivery rates, order tracking, and packaging.',
      content: `<h2>Worldwide Logistics & White-Glove Dispatch</h2>
<p>Every order dispatched from AURA fulfillment centers is picked, inspected, and packaged in protective, recyclable materials designed to ensure immaculate arrival.</p>
<h3>Shipping Tiers & Delivery Timelines</h3>
<ul>
  <li><strong>Standard Domestic Delivery (3-5 business days):</strong> Complimentary on all domestic orders over $75.</li>
  <li><strong>Priority Express Air (1-2 business days):</strong> $18 flat rate or complimentary on orders over $250.</li>
  <li><strong>International Global Courier (4-8 business days):</strong> Calculated dynamically at checkout with duties prepaid for over 45 supported nations.</li>
</ul>`,
    },
  ];

  for (const page of cmsPagesData) {
    const existing = await prisma.cMSPages.findFirst({ where: { Slug: page.slug } });
    if (!existing) {
      await prisma.cMSPages.create({
        data: {
          PageType: page.pageType,
          Title: page.title,
          Slug: page.slug,
          Content: page.content,
          Status: 'PUBLISHED',
          MetaTitle: page.metaTitle,
          MetaDescription: page.metaDescription,
          IsSystemPage: true,
          CreatedAt: new Date(),
          CreatedBy: adminUserId,
        },
      });
      console.log(` Created CMS Page: ${page.title} (/pages/${page.slug})`);
    }
  }

  // 13. Seed Baseline FAQ Sections & Items
  console.log('❓ Seeding FAQ Sections & Items...');
  const faqSectionsData = [
    {
      title: 'Orders & Shipping',
      slug: 'orders-shipping',
      displayOrder: 1,
      items: [
        {
          question: 'How long does standard domestic delivery take?',
          answer: 'Standard domestic delivery takes 3 to 5 business days. We provide express next-day air dispatch for eligible metro locations.',
          displayOrder: 1,
        },
        {
          question: 'How do I track my active shipment?',
          answer: 'Click "Track Order" in the top utility bar or footer and input your Order ID alongside your account email for real-time courier telemetry.',
          displayOrder: 2,
        },
        {
          question: 'Do you deliver internationally?',
          answer: 'Yes, we ship to over 45 countries worldwide via DHL Express with all import duties and taxes calculated transparently at checkout.',
          displayOrder: 3,
        },
      ],
    },
    {
      title: 'Returns & Refunds',
      slug: 'returns-refunds',
      displayOrder: 2,
      items: [
        {
          question: 'What is your return policy timeframe?',
          answer: 'We provide a 30-day return window from the confirmed delivery date. All items must be unused with tags and original packaging intact.',
          displayOrder: 1,
        },
        {
          question: 'How quickly are refunds processed?',
          answer: 'Once your return package arrives at our verification hub, refunds are inspected and credited to your original payment method in 3 to 5 business days.',
          displayOrder: 2,
        },
        {
          question: 'Are return shipping labels free?',
          answer: 'Yes! Domestic returns within 30 days receive complimentary prepaid courier return labels generated instantly via our support concierge.',
          displayOrder: 3,
        },
      ],
    },
    {
      title: 'Payment & Security',
      slug: 'payment-security',
      displayOrder: 3,
      items: [
        {
          question: 'What payment methods do you accept?',
          answer: 'We accept Visa, MasterCard, American Express, Apple Pay, Google Pay, PayPal, and flexible Buy-Now-Pay-Later installment plans.',
          displayOrder: 1,
        },
        {
          question: 'Is my credit card data stored on your servers?',
          answer: 'Never. Card processing is tokenized directly through PCI-DSS Level 1 certified gateways. We never access or store raw card numbers.',
          displayOrder: 2,
        },
      ],
    },
    {
      title: 'Account & Concierge Support',
      slug: 'account-concierge',
      displayOrder: 4,
      items: [
        {
          question: 'Can I check out as a guest without creating a password?',
          answer: 'Yes, guest checkout is always available. Registering an account is completely optional, though it unlocks instant order tracking and saved addresses.',
          displayOrder: 1,
        },
        {
          question: 'How can I reach your customer support concierge?',
          answer: 'Our concierge team is available Monday through Friday from 9 AM to 8 PM EST via live chat, telephone at +1 (800) 492-2872, or email at concierge@aura-commerce.com.',
          displayOrder: 2,
        },
      ],
    },
  ];

  for (const sec of faqSectionsData) {
    let section = await prisma.fAQSections.findFirst({ where: { Slug: sec.slug } });
    if (!section) {
      section = await prisma.fAQSections.create({
        data: {
          Title: sec.title,
          Slug: sec.slug,
          DisplayOrder: sec.displayOrder,
          Status: 'ACTIVE',
          CreatedAt: new Date(),
          CreatedBy: adminUserId,
        },
      });
      console.log(` Created FAQ Section: ${sec.title}`);
    }

    for (const item of sec.items) {
      const existingItem = await prisma.fAQItems.findFirst({
        where: { FAQSectionID: section.FAQSectionID, Question: item.question },
      });
      if (!existingItem) {
        await prisma.fAQItems.create({
          data: {
            FAQSectionID: section.FAQSectionID,
            Question: item.question,
            Answer: item.answer,
            DisplayOrder: item.displayOrder,
            Status: 'ACTIVE',
            CreatedAt: new Date(),
            CreatedBy: adminUserId,
          },
        });
        console.log(`   Added FAQ: ${item.question}`);
      }
    }
  }

  // 14. Seed Baseline Contact Info
  console.log('📍 Seeding Contact Info...');
  const existingContact = await prisma.contactInfo.findFirst({ where: { IsActive: true } });
  if (!existingContact) {
    await prisma.contactInfo.create({
      data: {
        Email: 'concierge@aura-commerce.com',
        Phone: '+1 (800) 492-2872',
        SupportPhone: '+1 (800) 492-2873',
        AddressLine1: '452 Broadway, SoHo Design District',
        AddressLine2: 'Suite 400',
        City: 'New York',
        State: 'NY',
        Country: 'United States',
        PostalCode: '10013',
        BusinessHours: 'Mon – Fri: 9:00 AM – 8:00 PM EST, Sat: 10:00 AM – 6:00 PM EST',
        MapEmbedURL: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3023.633519803273!2d-73.9996526!3d40.7227448!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c2598be69d5119%3A0x67ee0be780f2d4f2!2s452%20Broadway%2C%20New%20York%2C%20NY%2010013!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus',
        IsActive: true,
        CreatedAt: new Date(),
        CreatedBy: adminUserId,
      },
    });
    console.log(' Configured baseline Contact Info');
  }

  // 15. Seed Baseline Social Links
  console.log('🔗 Seeding Social Links...');
  const socialLinksData = [
    { platform: 'INSTAGRAM', label: 'Instagram', url: 'https://instagram.com/aura_commerce', order: 1, active: true },
    { platform: 'TWITTER', label: 'Twitter / X', url: 'https://twitter.com/aura_commerce', order: 2, active: true },
    { platform: 'FACEBOOK', label: 'Facebook', url: 'https://facebook.com/auracommerce', order: 3, active: true },
    { platform: 'LINKEDIN', label: 'LinkedIn', url: 'https://linkedin.com/company/aura-commerce', order: 4, active: true },
    { platform: 'YOUTUBE', label: 'YouTube', url: 'https://youtube.com/@auracommerce', order: 5, active: true },
    { platform: 'PINTEREST', label: 'Pinterest', url: 'https://pinterest.com/auracommerce', order: 6, active: true },
    { platform: 'TIKTOK', label: 'TikTok', url: 'https://tiktok.com/@auracommerce', order: 7, active: false },
    { platform: 'WHATSAPP', label: 'WhatsApp Concierge', url: 'https://wa.me/18004922872', order: 8, active: true },
  ];

  for (const s of socialLinksData) {
    const existing = await prisma.socialLinks.findFirst({ where: { Platform: s.platform } });
    if (!existing) {
      await prisma.socialLinks.create({
        data: {
          Platform: s.platform,
          Label: s.label,
          URL: s.url,
          DisplayOrder: s.order,
          IsActive: s.active,
          CreatedAt: new Date(),
          CreatedBy: adminUserId,
        },
      });
      console.log(` Configured Social Link: ${s.platform}`);
    }
  }

  console.log('✅ Database seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
