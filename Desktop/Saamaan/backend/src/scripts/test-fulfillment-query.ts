import { getPool, closePool } from '../database/db.js';
import { warehouseFulfillmentsService } from '../modules/warehouses/warehouseFulfillments.service.js';
import { warehousesService } from '../modules/warehouses/warehouses.service.js';

async function test() {
  const pool = await getPool();
  try {
    // 1. Check warehouses in DB
    const whs = await pool.request().query('SELECT TOP 5 WarehouseID, WarehouseName FROM dbo.Warehouses');
    console.log('Warehouses:', whs.recordset);

    if (whs.recordset.length > 0) {
      const whId = BigInt(whs.recordset[0].WarehouseID);
      console.log('Testing listFulfillments for warehouse ID:', whId);
      const res = await warehouseFulfillmentsService.listFulfillments(whId);
      console.log('listFulfillments success! Count:', res.length);
    }

    // 2. Check warehouse users
    const users = await pool.request().query(`
      SELECT TOP 5 wu.WarehouseID, wu.UserID, u.Email 
      FROM dbo.WarehouseUsers wu
      JOIN dbo.Users u ON wu.UserID = u.UserID
    `);
    console.log('WarehouseUsers:', users.recordset);

    if (users.recordset.length > 0) {
      const uId = BigInt(users.recordset[0].UserID);
      console.log('Testing getMyWarehouse for user ID:', uId);
      const myWh = await warehousesService.getMyWarehouse(uId);
      console.log('getMyWarehouse result:', myWh);
    }
  } catch (err: any) {
    console.error('ERROR OCCURRED:');
    console.error(err.message);
    console.error(err.stack);
  } finally {
    await closePool();
  }
}

test().catch(console.error);
