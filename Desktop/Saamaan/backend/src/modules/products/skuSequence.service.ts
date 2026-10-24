import { getPool } from '../../database/db.js';
import { logger } from '../../utils/logger.js';

class SKUSequenceService {
  private sequenceInitialized = false;

  /**
   * Idempotently ensures that dbo.ProductMasterSKUSequence exists in SQL Server.
   */
  async ensureSequenceExists(): Promise<void> {
    if (this.sequenceInitialized) return;

    try {
      const pool = await getPool();
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.sequences WHERE name = 'ProductMasterSKUSequence')
        BEGIN
            CREATE SEQUENCE dbo.ProductMasterSKUSequence
                AS BIGINT
                START WITH 1
                INCREMENT BY 1;
        END
      `);
      this.sequenceInitialized = true;
      logger.info('dbo.ProductMasterSKUSequence verified/initialized', 'SKUSequenceService');
    } catch (err) {
      logger.error('Failed to initialize dbo.ProductMasterSKUSequence', err, 'SKUSequenceService');
      throw err;
    }
  }

  /**
   * Fetches the next atomic sequence integer from dbo.ProductMasterSKUSequence.
   */
  async getNextSequenceValue(): Promise<bigint> {
    await this.ensureSequenceExists();

    const pool = await getPool();
    const result = await pool.request().query<{ nextVal: bigint | number | string }>(
      `SELECT NEXT VALUE FOR dbo.ProductMasterSKUSequence AS nextVal`
    );

    if (!result.recordset || result.recordset.length === 0 || result.recordset[0].nextVal === undefined) {
      throw new Error('Failed to retrieve NEXT VALUE FOR dbo.ProductMasterSKUSequence');
    }

    return BigInt(result.recordset[0].nextVal);
  }

  /**
   * Generates a permanent ParentSKU using the rule:
   * BrandCode + "-" + CategoryCode + "-" + GlobalSequence (padded to 6 digits)
   * Example: HOG-DRO-000001
   */
  async generateParentSKU(brandCode: string, categoryCode: string): Promise<string> {
    const seq = await this.getNextSequenceValue();
    const cleanBrand = (brandCode || 'BRD').toUpperCase().trim().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'GEN';
    const cleanCategory = (categoryCode || 'CAT').toUpperCase().trim().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'GEN';
    const paddedSeq = seq.toString().padStart(6, '0');

    return `${cleanBrand}-${cleanCategory}-${paddedSeq}`;
  }

  /**
   * Generates a deterministic VariantSKU from ParentSKU and controlled AttributeValueCodes
   * Example: HOG-DRO-000001-BLK-M
   */
  generateVariantSKU(parentSku: string, attributeValueCodes: string[]): string {
    const cleanCodes = attributeValueCodes
      .map((c) => c.toUpperCase().trim().replace(/[^A-Z0-9]/g, ''))
      .filter((c) => c.length > 0);

    if (cleanCodes.length === 0) {
      return `${parentSku}-STD`;
    }

    return `${parentSku}-${cleanCodes.join('-')}`;
  }
}

export const skuSequenceService = new SKUSequenceService();
