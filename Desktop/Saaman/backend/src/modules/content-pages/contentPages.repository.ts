import { getPool, sql } from '../../database/db.js';

export interface CMSPageRecord {
  PageID: bigint | number;
  PageType: string;
  Title: string;
  Slug: string;
  Content?: string;
  Status: string;
  MetaTitle?: string | null;
  MetaDescription?: string | null;
  IsSystemPage?: boolean;
  CreatedAt: Date;
  CreatedBy?: bigint | number | null;
  UpdatedAt?: Date | null;
  UpdatedBy?: bigint | number | null;
  CreatedByUser?: { FirstName: string; LastName: string; Email: string } | null;
  UpdatedByUser?: { FirstName: string; LastName: string; Email?: string } | null;
}

export interface FAQSectionRecord {
  FAQSectionID: bigint | number;
  Title: string;
  Slug: string;
  DisplayOrder: number;
  Status: string;
  CreatedAt: Date;
  UpdatedAt?: Date | null;
  Items?: FAQItemRecord[];
}

export interface FAQItemRecord {
  FAQItemID: bigint | number;
  FAQSectionID: bigint | number;
  Question: string;
  Answer: string;
  DisplayOrder: number;
  Status: string;
  CreatedAt: Date;
  UpdatedAt?: Date | null;
}

export interface ContactInfoRecord {
  ContactInfoID: bigint | number;
  Email: string;
  Phone?: string | null;
  SupportPhone?: string | null;
  AddressLine1?: string | null;
  AddressLine2?: string | null;
  City?: string | null;
  State?: string | null;
  Country?: string | null;
  PostalCode?: string | null;
  BusinessHours?: string | null;
  MapEmbedURL?: string | null;
  IsActive: boolean;
  CreatedAt: Date;
  CreatedBy?: bigint | number | null;
  UpdatedAt?: Date | null;
  UpdatedBy?: bigint | number | null;
}

export interface SocialLinkRecord {
  SocialLinkID: bigint | number;
  Platform: string;
  Label: string;
  URL: string;
  IconName?: string | null;
  DisplayOrder: number;
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt?: Date | null;
}

export class ContentPagesRepository {
  // ==========================================
  // CMS PAGES
  // ==========================================

  async listPublishedPages(): Promise<Partial<CMSPageRecord>[]> {
    const pool = await getPool();
    const result = await pool.request().query<Partial<CMSPageRecord>>(`
      SELECT PageID, PageType, Title, Slug, MetaTitle, MetaDescription, IsSystemPage, UpdatedAt
      FROM CMSPages
      WHERE Status = 'PUBLISHED'
      ORDER BY Title ASC
    `);
    return result.recordset;
  }

  async getPublishedPageBySlug(slug: string): Promise<any | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('slug', sql.VarChar(255), slug)
      .query(`
        SELECT 
          p.PageID, p.PageType, p.Title, p.Slug, p.Content, 
          p.MetaTitle, p.MetaDescription, p.IsSystemPage, p.UpdatedAt,
          u.FirstName, u.LastName
        FROM CMSPages p
        LEFT JOIN Users u ON p.UpdatedBy = u.UserID
        WHERE p.Slug = @slug AND p.Status = 'PUBLISHED'
      `);

    const row = result.recordset[0];
    if (!row) return null;

    return {
      PageID: row.PageID,
      PageType: row.PageType,
      Title: row.Title,
      Slug: row.Slug,
      Content: row.Content,
      MetaTitle: row.MetaTitle,
      MetaDescription: row.MetaDescription,
      IsSystemPage: row.IsSystemPage,
      UpdatedAt: row.UpdatedAt,
      Users_CMSPages_UpdatedByToUsers: row.FirstName
        ? { FirstName: row.FirstName, LastName: row.LastName }
        : null,
    };
  }

  async adminListAllPages(): Promise<any[]> {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        p.PageID, p.PageType, p.Title, p.Slug, p.Content, p.Status, 
        p.IsSystemPage, p.MetaTitle, p.MetaDescription, 
        p.CreatedAt, p.UpdatedAt,
        cu.FirstName AS C_FirstName, cu.LastName AS C_LastName, cu.Email AS C_Email,
        uu.FirstName AS U_FirstName, uu.LastName AS U_LastName, uu.Email AS U_Email
      FROM CMSPages p
      LEFT JOIN Users cu ON p.CreatedBy = cu.UserID
      LEFT JOIN Users uu ON p.UpdatedBy = uu.UserID
      ORDER BY p.PageType ASC, p.CreatedAt DESC
    `);

    return result.recordset.map((row) => ({
      PageID: row.PageID,
      PageType: row.PageType,
      Title: row.Title,
      Slug: row.Slug,
      Content: row.Content,
      Status: row.Status,
      IsSystemPage: row.IsSystemPage,
      MetaTitle: row.MetaTitle,
      MetaDescription: row.MetaDescription,
      CreatedAt: row.CreatedAt,
      UpdatedAt: row.UpdatedAt,
      Users_CMSPages_CreatedByToUsers: row.C_FirstName
        ? { FirstName: row.C_FirstName, LastName: row.C_LastName, Email: row.C_Email }
        : null,
      Users_CMSPages_UpdatedByToUsers: row.U_FirstName
        ? { FirstName: row.U_FirstName, LastName: row.U_LastName, Email: row.U_Email }
        : null,
    }));
  }

  async findPageById(pageId: bigint): Promise<CMSPageRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('pageId', sql.BigInt, pageId)
      .query<CMSPageRecord>('SELECT * FROM CMSPages WHERE PageID = @pageId');
    return result.recordset[0] ?? null;
  }

  async findPageBySlug(slug: string): Promise<CMSPageRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('slug', sql.VarChar(255), slug)
      .query<CMSPageRecord>('SELECT * FROM CMSPages WHERE Slug = @slug');
    return result.recordset[0] ?? null;
  }

  async findSystemPageByType(pageType: string): Promise<CMSPageRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('pageType', sql.VarChar(50), pageType)
      .query<CMSPageRecord>('SELECT * FROM CMSPages WHERE PageType = @pageType AND IsSystemPage = 1');
    return result.recordset[0] ?? null;
  }

  async createPage(data: {
    pageType: string;
    title: string;
    slug: string;
    content: string;
    status: string;
    metaTitle?: string | null;
    metaDescription?: string | null;
    isSystemPage: boolean;
    createdBy?: bigint | null;
    createdAt: Date;
  }): Promise<CMSPageRecord> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('pageType', sql.VarChar(50), data.pageType)
      .input('title', sql.NVarChar(255), data.title)
      .input('slug', sql.VarChar(255), data.slug)
      .input('content', sql.NVarChar(sql.MAX), data.content)
      .input('status', sql.VarChar(20), data.status)
      .input('metaTitle', sql.NVarChar(255), data.metaTitle ?? null)
      .input('metaDescription', sql.NVarChar(500), data.metaDescription ?? null)
      .input('isSystemPage', sql.Bit, data.isSystemPage ? 1 : 0)
      .input('createdBy', sql.BigInt, data.createdBy ?? null)
      .input('createdAt', sql.DateTime2, data.createdAt)
      .query<CMSPageRecord>(`
        INSERT INTO CMSPages (
          PageType, Title, Slug, Content, Status, 
          MetaTitle, MetaDescription, IsSystemPage, CreatedBy, CreatedAt
        )
        OUTPUT Inserted.*
        VALUES (
          @pageType, @title, @slug, @content, @status, 
          @metaTitle, @metaDescription, @isSystemPage, @createdBy, @createdAt
        )
      `);
    return result.recordset[0];
  }

  async updatePage(pageId: bigint, updates: Partial<{
    Title: string;
    Slug: string;
    Content: string;
    Status: string;
    MetaTitle: string | null;
    MetaDescription: string | null;
    UpdatedAt: Date;
    UpdatedBy: bigint | null;
  }>): Promise<CMSPageRecord | null> {
    const pool = await getPool();
    const req = pool.request().input('pageId', sql.BigInt, pageId);
    const setClauses: string[] = [];

    if (updates.Title !== undefined) {
      req.input('title', sql.NVarChar(255), updates.Title);
      setClauses.push('Title = @title');
    }
    if (updates.Slug !== undefined) {
      req.input('slug', sql.VarChar(255), updates.Slug);
      setClauses.push('Slug = @slug');
    }
    if (updates.Content !== undefined) {
      req.input('content', sql.NVarChar(sql.MAX), updates.Content);
      setClauses.push('Content = @content');
    }
    if (updates.Status !== undefined) {
      req.input('status', sql.VarChar(20), updates.Status);
      setClauses.push('Status = @status');
    }
    if (updates.MetaTitle !== undefined) {
      req.input('metaTitle', sql.NVarChar(255), updates.MetaTitle);
      setClauses.push('MetaTitle = @metaTitle');
    }
    if (updates.MetaDescription !== undefined) {
      req.input('metaDescription', sql.NVarChar(500), updates.MetaDescription);
      setClauses.push('MetaDescription = @metaDescription');
    }
    if (updates.UpdatedAt !== undefined) {
      req.input('updatedAt', sql.DateTime2, updates.UpdatedAt);
      setClauses.push('UpdatedAt = @updatedAt');
    }
    if (updates.UpdatedBy !== undefined) {
      req.input('updatedBy', sql.BigInt, updates.UpdatedBy);
      setClauses.push('UpdatedBy = @updatedBy');
    }

    if (setClauses.length === 0) return this.findPageById(pageId);

    const query = `
      UPDATE CMSPages
      SET ${setClauses.join(', ')}
      OUTPUT Inserted.*
      WHERE PageID = @pageId
    `;

    const result = await req.query<CMSPageRecord>(query);
    return result.recordset[0] ?? null;
  }

  async deletePage(pageId: bigint): Promise<void> {
    const pool = await getPool();
    await pool.request().input('pageId', sql.BigInt, pageId).query('DELETE FROM CMSPages WHERE PageID = @pageId');
  }

  // ==========================================
  // FAQS
  // ==========================================

  async listPublicFaqs(): Promise<any[]> {
    const pool = await getPool();
    const sectionsRes = await pool.request().query<FAQSectionRecord>(`
      SELECT FAQSectionID, Title, Slug, DisplayOrder, Status
      FROM FAQSections
      WHERE Status = 'ACTIVE'
      ORDER BY DisplayOrder ASC, Title ASC
    `);

    const itemsRes = await pool.request().query<FAQItemRecord>(`
      SELECT FAQItemID, FAQSectionID, Question, Answer, DisplayOrder, Status
      FROM FAQItems
      WHERE Status = 'ACTIVE'
      ORDER BY DisplayOrder ASC
    `);

    const itemsBySection = new Map<string, any[]>();
    for (const item of itemsRes.recordset) {
      const sId = String(item.FAQSectionID);
      if (!itemsBySection.has(sId)) itemsBySection.set(sId, []);
      itemsBySection.get(sId)!.push({
        FAQItemID: item.FAQItemID,
        Question: item.Question,
        Answer: item.Answer,
        DisplayOrder: item.DisplayOrder,
      });
    }

    return sectionsRes.recordset.map((sec) => ({
      FAQSectionID: sec.FAQSectionID,
      Title: sec.Title,
      Slug: sec.Slug,
      DisplayOrder: sec.DisplayOrder,
      FAQItems: itemsBySection.get(String(sec.FAQSectionID)) || [],
    }));
  }

  async adminListFaqSections(): Promise<any[]> {
    const pool = await getPool();
    const sectionsRes = await pool.request().query<FAQSectionRecord>(`
      SELECT FAQSectionID, Title, Slug, DisplayOrder, Status, CreatedAt, UpdatedAt
      FROM FAQSections
      ORDER BY DisplayOrder ASC
    `);

    const itemsRes = await pool.request().query<FAQItemRecord>(`
      SELECT FAQItemID, FAQSectionID, Question, Answer, DisplayOrder, Status, CreatedAt, UpdatedAt
      FROM FAQItems
      ORDER BY DisplayOrder ASC
    `);

    const itemsBySection = new Map<string, any[]>();
    for (const item of itemsRes.recordset) {
      const sId = String(item.FAQSectionID);
      if (!itemsBySection.has(sId)) itemsBySection.set(sId, []);
      itemsBySection.get(sId)!.push(item);
    }

    return sectionsRes.recordset.map((sec) => ({
      ...sec,
      FAQItems: itemsBySection.get(String(sec.FAQSectionID)) || [],
    }));
  }

  async findFaqSectionById(sectionId: bigint): Promise<FAQSectionRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.BigInt, sectionId)
      .query<FAQSectionRecord>('SELECT * FROM FAQSections WHERE FAQSectionID = @id');
    return result.recordset[0] ?? null;
  }

  async findFaqSectionBySlug(slug: string): Promise<FAQSectionRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('slug', sql.VarChar(100), slug)
      .query<FAQSectionRecord>('SELECT * FROM FAQSections WHERE Slug = @slug');
    return result.recordset[0] ?? null;
  }

  async createFaqSection(data: {
    title: string;
    slug: string;
    displayOrder: number;
    status: string;
    createdBy?: bigint | null;
    createdAt: Date;
  }): Promise<FAQSectionRecord> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('title', sql.NVarChar(255), data.title)
      .input('slug', sql.VarChar(100), data.slug)
      .input('displayOrder', sql.Int, data.displayOrder)
      .input('status', sql.VarChar(20), data.status)
      .input('createdBy', sql.BigInt, data.createdBy ?? null)
      .input('createdAt', sql.DateTime2, data.createdAt)
      .query<FAQSectionRecord>(`
        INSERT INTO FAQSections (Title, Slug, DisplayOrder, Status, CreatedBy, CreatedAt)
        OUTPUT Inserted.*
        VALUES (@title, @slug, @displayOrder, @status, @createdBy, @createdAt)
      `);
    return result.recordset[0];
  }

  async updateFaqSection(sectionId: bigint, updates: Partial<{
    Title: string;
    Slug: string;
    DisplayOrder: number;
    Status: string;
    UpdatedAt: Date;
    UpdatedBy: bigint | null;
  }>): Promise<FAQSectionRecord | null> {
    const pool = await getPool();
    const req = pool.request().input('id', sql.BigInt, sectionId);
    const setClauses: string[] = [];

    if (updates.Title !== undefined) {
      req.input('title', sql.NVarChar(255), updates.Title);
      setClauses.push('Title = @title');
    }
    if (updates.Slug !== undefined) {
      req.input('slug', sql.VarChar(100), updates.Slug);
      setClauses.push('Slug = @slug');
    }
    if (updates.DisplayOrder !== undefined) {
      req.input('displayOrder', sql.Int, updates.DisplayOrder);
      setClauses.push('DisplayOrder = @displayOrder');
    }
    if (updates.Status !== undefined) {
      req.input('status', sql.VarChar(20), updates.Status);
      setClauses.push('Status = @status');
    }
    if (updates.UpdatedAt !== undefined) {
      req.input('updatedAt', sql.DateTime2, updates.UpdatedAt);
      setClauses.push('UpdatedAt = @updatedAt');
    }
    if (updates.UpdatedBy !== undefined) {
      req.input('updatedBy', sql.BigInt, updates.UpdatedBy);
      setClauses.push('UpdatedBy = @updatedBy');
    }

    if (setClauses.length === 0) return this.findFaqSectionById(sectionId);

    const query = `
      UPDATE FAQSections
      SET ${setClauses.join(', ')}
      OUTPUT Inserted.*
      WHERE FAQSectionID = @id
    `;
    const result = await req.query<FAQSectionRecord>(query);
    return result.recordset[0] ?? null;
  }

  async deleteFaqSection(sectionId: bigint): Promise<void> {
    const pool = await getPool();
    await pool.request().input('id', sql.BigInt, sectionId).query(`
      DELETE FROM FAQItems WHERE FAQSectionID = @id;
      DELETE FROM FAQSections WHERE FAQSectionID = @id;
    `);
  }

  async findFaqItemById(itemId: bigint): Promise<FAQItemRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.BigInt, itemId)
      .query<FAQItemRecord>('SELECT * FROM FAQItems WHERE FAQItemID = @id');
    return result.recordset[0] ?? null;
  }

  async createFaqItem(data: {
    sectionId: bigint;
    question: string;
    answer: string;
    displayOrder: number;
    status: string;
    createdBy?: bigint | null;
    createdAt: Date;
  }): Promise<FAQItemRecord> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('sectionId', sql.BigInt, data.sectionId)
      .input('question', sql.NVarChar(500), data.question)
      .input('answer', sql.NVarChar(sql.MAX), data.answer)
      .input('displayOrder', sql.Int, data.displayOrder)
      .input('status', sql.VarChar(20), data.status)
      .input('createdBy', sql.BigInt, data.createdBy ?? null)
      .input('createdAt', sql.DateTime2, data.createdAt)
      .query<FAQItemRecord>(`
        INSERT INTO FAQItems (FAQSectionID, Question, Answer, DisplayOrder, Status, CreatedBy, CreatedAt)
        OUTPUT Inserted.*
        VALUES (@sectionId, @question, @answer, @displayOrder, @status, @createdBy, @createdAt)
      `);
    return result.recordset[0];
  }

  async updateFaqItem(itemId: bigint, updates: Partial<{
    Question: string;
    Answer: string;
    DisplayOrder: number;
    Status: string;
    UpdatedAt: Date;
    UpdatedBy: bigint | null;
  }>): Promise<FAQItemRecord | null> {
    const pool = await getPool();
    const req = pool.request().input('id', sql.BigInt, itemId);
    const setClauses: string[] = [];

    if (updates.Question !== undefined) {
      req.input('question', sql.NVarChar(500), updates.Question);
      setClauses.push('Question = @question');
    }
    if (updates.Answer !== undefined) {
      req.input('answer', sql.NVarChar(sql.MAX), updates.Answer);
      setClauses.push('Answer = @answer');
    }
    if (updates.DisplayOrder !== undefined) {
      req.input('displayOrder', sql.Int, updates.DisplayOrder);
      setClauses.push('DisplayOrder = @displayOrder');
    }
    if (updates.Status !== undefined) {
      req.input('status', sql.VarChar(20), updates.Status);
      setClauses.push('Status = @status');
    }
    if (updates.UpdatedAt !== undefined) {
      req.input('updatedAt', sql.DateTime2, updates.UpdatedAt);
      setClauses.push('UpdatedAt = @updatedAt');
    }
    if (updates.UpdatedBy !== undefined) {
      req.input('updatedBy', sql.BigInt, updates.UpdatedBy);
      setClauses.push('UpdatedBy = @updatedBy');
    }

    if (setClauses.length === 0) return this.findFaqItemById(itemId);

    const query = `
      UPDATE FAQItems
      SET ${setClauses.join(', ')}
      OUTPUT Inserted.*
      WHERE FAQItemID = @id
    `;
    const result = await req.query<FAQItemRecord>(query);
    return result.recordset[0] ?? null;
  }

  async deleteFaqItem(itemId: bigint): Promise<void> {
    const pool = await getPool();
    await pool.request().input('id', sql.BigInt, itemId).query('DELETE FROM FAQItems WHERE FAQItemID = @id');
  }

  // ==========================================
  // CONTACT INFO
  // ==========================================

  async getActiveContactInfo(): Promise<ContactInfoRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .query<ContactInfoRecord>('SELECT TOP 1 * FROM ContactInfo WHERE IsActive = 1 ORDER BY CreatedAt DESC');
    return result.recordset[0] ?? null;
  }

  async getLatestContactInfo(): Promise<ContactInfoRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .query<ContactInfoRecord>('SELECT TOP 1 * FROM ContactInfo ORDER BY CreatedAt DESC');
    return result.recordset[0] ?? null;
  }

  async upsertContactInfo(data: Partial<ContactInfoRecord>, userId?: bigint): Promise<ContactInfoRecord> {
    const pool = await getPool();
    const existing = await this.getActiveContactInfo();

    if (existing) {
      const req = pool.request().input('id', sql.BigInt, existing.ContactInfoID);
      const setClauses: string[] = [];

      if (data.Email !== undefined) {
        req.input('email', sql.NVarChar(255), data.Email);
        setClauses.push('Email = @email');
      }
      if (data.Phone !== undefined) {
        req.input('phone', sql.NVarChar(50), data.Phone ?? null);
        setClauses.push('Phone = @phone');
      }
      if (data.SupportPhone !== undefined) {
        req.input('supportPhone', sql.NVarChar(50), data.SupportPhone ?? null);
        setClauses.push('SupportPhone = @supportPhone');
      }
      if (data.AddressLine1 !== undefined) {
        req.input('addr1', sql.NVarChar(255), data.AddressLine1 ?? null);
        setClauses.push('AddressLine1 = @addr1');
      }
      if (data.AddressLine2 !== undefined) {
        req.input('addr2', sql.NVarChar(255), data.AddressLine2 ?? null);
        setClauses.push('AddressLine2 = @addr2');
      }
      if (data.City !== undefined) {
        req.input('city', sql.NVarChar(100), data.City ?? null);
        setClauses.push('City = @city');
      }
      if (data.State !== undefined) {
        req.input('state', sql.NVarChar(100), data.State ?? null);
        setClauses.push('State = @state');
      }
      if (data.Country !== undefined) {
        req.input('country', sql.NVarChar(100), data.Country ?? null);
        setClauses.push('Country = @country');
      }
      if (data.PostalCode !== undefined) {
        req.input('postalCode', sql.NVarChar(20), data.PostalCode ?? null);
        setClauses.push('PostalCode = @postalCode');
      }
      if (data.BusinessHours !== undefined) {
        req.input('businessHours', sql.NVarChar(255), data.BusinessHours ?? null);
        setClauses.push('BusinessHours = @businessHours');
      }
      if (data.MapEmbedURL !== undefined) {
        req.input('mapEmbedURL', sql.NVarChar(sql.MAX), data.MapEmbedURL ?? null);
        setClauses.push('MapEmbedURL = @mapEmbedURL');
      }

      req.input('updatedAt', sql.DateTime2, new Date());
      setClauses.push('UpdatedAt = @updatedAt');
      req.input('updatedBy', sql.BigInt, userId ?? null);
      setClauses.push('UpdatedBy = @updatedBy');

      const query = `
        UPDATE ContactInfo
        SET ${setClauses.join(', ')}
        OUTPUT Inserted.*
        WHERE ContactInfoID = @id
      `;

      const result = await req.query<ContactInfoRecord>(query);
      return result.recordset[0];
    } else {
      const result = await pool
        .request()
        .input('email', sql.NVarChar(255), data.Email || 'support@saamaan.store')
        .input('phone', sql.NVarChar(50), data.Phone ?? null)
        .input('supportPhone', sql.NVarChar(50), data.SupportPhone ?? null)
        .input('addr1', sql.NVarChar(255), data.AddressLine1 ?? null)
        .input('addr2', sql.NVarChar(255), data.AddressLine2 ?? null)
        .input('city', sql.NVarChar(100), data.City ?? null)
        .input('state', sql.NVarChar(100), data.State ?? null)
        .input('country', sql.NVarChar(100), data.Country ?? null)
        .input('postalCode', sql.NVarChar(20), data.PostalCode ?? null)
        .input('businessHours', sql.NVarChar(255), data.BusinessHours ?? null)
        .input('mapEmbedURL', sql.NVarChar(sql.MAX), data.MapEmbedURL ?? null)
        .input('isActive', sql.Bit, 1)
        .input('createdAt', sql.DateTime2, new Date())
        .input('createdBy', sql.BigInt, userId ?? null)
        .query<ContactInfoRecord>(`
          INSERT INTO ContactInfo (
            Email, Phone, SupportPhone, AddressLine1, AddressLine2, 
            City, State, Country, PostalCode, BusinessHours, 
            MapEmbedURL, IsActive, CreatedAt, CreatedBy
          )
          OUTPUT Inserted.*
          VALUES (
            @email, @phone, @supportPhone, @addr1, @addr2, 
            @city, @state, @country, @postalCode, @businessHours, 
            @mapEmbedURL, @isActive, @createdAt, @createdBy
          )
        `);

      return result.recordset[0];
    }
  }

  // ==========================================
  // SOCIAL LINKS
  // ==========================================

  async listPublicSocialLinks(): Promise<SocialLinkRecord[]> {
    const pool = await getPool();
    const result = await pool.request().query<SocialLinkRecord>(`
      SELECT SocialLinkID, Platform, Label, URL, IconName, DisplayOrder
      FROM SocialLinks
      WHERE IsActive = 1
      ORDER BY DisplayOrder ASC
    `);
    return result.recordset;
  }

  async adminListSocialLinks(): Promise<SocialLinkRecord[]> {
    const pool = await getPool();
    const result = await pool.request().query<SocialLinkRecord>(`
      SELECT SocialLinkID, Platform, Label, URL, IconName, DisplayOrder, IsActive, CreatedAt, UpdatedAt
      FROM SocialLinks
      ORDER BY DisplayOrder ASC
    `);
    return result.recordset;
  }

  async findSocialLinkByPlatform(platform: string): Promise<SocialLinkRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('platform', sql.VarChar(50), platform.trim().toUpperCase())
      .query<SocialLinkRecord>('SELECT * FROM SocialLinks WHERE Platform = @platform');
    return result.recordset[0] ?? null;
  }

  async findSocialLinkById(linkId: bigint): Promise<SocialLinkRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.BigInt, linkId)
      .query<SocialLinkRecord>('SELECT * FROM SocialLinks WHERE SocialLinkID = @id');
    return result.recordset[0] ?? null;
  }

  async upsertSocialLink(data: {
    platform: string;
    label: string;
    url: string;
    iconName?: string | null;
    displayOrder: number;
    isActive: boolean;
  }, userId?: bigint): Promise<SocialLinkRecord> {
    const pool = await getPool();
    const platform = data.platform.trim().toUpperCase();
    const existing = await this.findSocialLinkByPlatform(platform);

    if (existing) {
      const result = await pool
        .request()
        .input('id', sql.BigInt, existing.SocialLinkID)
        .input('label', sql.NVarChar(100), data.label.trim())
        .input('url', sql.NVarChar(sql.MAX), data.url.trim())
        .input('iconName', sql.VarChar(50), data.iconName?.trim() || null)
        .input('displayOrder', sql.Int, data.displayOrder)
        .input('isActive', sql.Bit, data.isActive ? 1 : 0)
        .input('updatedAt', sql.DateTime2, new Date())
        .input('updatedBy', sql.BigInt, userId ?? null)
        .query<SocialLinkRecord>(`
          UPDATE SocialLinks
          SET 
            Label = @label, 
            URL = @url, 
            IconName = @iconName, 
            DisplayOrder = @displayOrder, 
            IsActive = @isActive, 
            UpdatedAt = @updatedAt, 
            UpdatedBy = @updatedBy
          OUTPUT Inserted.*
          WHERE SocialLinkID = @id
        `);
      return result.recordset[0];
    } else {
      const result = await pool
        .request()
        .input('platform', sql.VarChar(50), platform)
        .input('label', sql.NVarChar(100), data.label.trim())
        .input('url', sql.NVarChar(sql.MAX), data.url.trim())
        .input('iconName', sql.VarChar(50), data.iconName?.trim() || null)
        .input('displayOrder', sql.Int, data.displayOrder)
        .input('isActive', sql.Bit, data.isActive ? 1 : 0)
        .input('createdAt', sql.DateTime2, new Date())
        .input('createdBy', sql.BigInt, userId ?? null)
        .query<SocialLinkRecord>(`
          INSERT INTO SocialLinks (
            Platform, Label, URL, IconName, DisplayOrder, IsActive, CreatedAt, CreatedBy
          )
          OUTPUT Inserted.*
          VALUES (
            @platform, @label, @url, @iconName, @displayOrder, @isActive, @createdAt, @createdBy
          )
        `);
      return result.recordset[0];
    }
  }

  async deleteSocialLink(linkId: bigint): Promise<void> {
    const pool = await getPool();
    await pool.request().input('id', sql.BigInt, linkId).query('DELETE FROM SocialLinks WHERE SocialLinkID = @id');
  }
}

export const contentPagesRepository = new ContentPagesRepository();
