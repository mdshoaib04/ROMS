import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import crypto from "crypto";
import * as schema from "./schema";

const { Pool } = pg;

export let db: any;
export let pool: any;
export let pgliteClient: PGlite | null = null;

function initPool() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.includes("localhost:5432")) {
    try {
      pool = new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 3000,
      });
      db = drizzlePg(pool, { schema });
      return;
    } catch (err) {
      console.warn("Postgres pool connection failed, using PGlite WASM Postgres engine.");
    }
  }

  // Native WASM Embedded Postgres engine
  pgliteClient = new PGlite("memory://");
  db = drizzlePglite(pgliteClient, { schema });
  pool = {
    query: async (queryText: string, params?: any[]) => {
      const res = await pgliteClient!.query(queryText, params);
      return { rows: res.rows };
    }
  };
}

initPool();

export function hashPassword(password: string): string {
  const secret = process.env.SESSION_SECRET || "inews-roms-secret";
  return crypto.createHash("sha256").update(password + secret).digest("hex");
}

export async function initDatabase() {
  try {
    // Execute DDL table creation statements
    const createTablesQueries = [
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'sales',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        contact_person TEXT,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        gst_number TEXT,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS agencies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'agency',
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS release_orders (
        id SERIAL PRIMARY KEY,
        ro_number TEXT NOT NULL UNIQUE,
        client_id INTEGER NOT NULL,
        agency_id INTEGER,
        status TEXT NOT NULL DEFAULT 'draft',
        ro_date TEXT,
        client_ro_reference TEXT,
        publish_from TEXT NOT NULL,
        publish_to TEXT NOT NULL,
        scroll_kannada BOOLEAN NOT NULL DEFAULT FALSE,
        scroll_marathi BOOLEAN NOT NULL DEFAULT FALSE,
        audio_video_kannada BOOLEAN NOT NULL DEFAULT FALSE,
        audio_video_marathi BOOLEAN NOT NULL DEFAULT FALSE,
        repeat_times INTEGER,
        spot_type TEXT,
        spot_duration TEXT,
        rate_per_day NUMERIC(10,2),
        bonus_spots INTEGER,
        media_design_required BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        rejection_reason TEXT,
        stop_reason TEXT,
        stopped_at TIMESTAMP,
        media_url TEXT,
        revision_note TEXT,
        revision_applied_at TIMESTAMP,
        approved_at TIMESTAMP,
        approved_by INTEGER,
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS playout_reports (
        id SERIAL PRIMARY KEY,
        release_order_id INTEGER NOT NULL,
        report_date TEXT NOT NULL,
        publish_from TEXT,
        publish_to TEXT,
        total_spots_scheduled INTEGER NOT NULL DEFAULT 0,
        total_spots_aired INTEGER NOT NULL DEFAULT 0,
        scroll_kannada_days INTEGER,
        scroll_marathi_days INTEGER,
        video_kannada_days INTEGER,
        video_marathi_days INTEGER,
        discrepancy_note TEXT,
        screenshot_url TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_number TEXT NOT NULL UNIQUE,
        client_id INTEGER NOT NULL,
        release_order_id INTEGER NOT NULL,
        playout_report_id INTEGER,
        agency_id INTEGER,
        ro_reference TEXT,
        publish_from TEXT NOT NULL,
        publish_to TEXT NOT NULL,
        scroll_kannada_days INTEGER,
        scroll_kannada_rate NUMERIC(10,2),
        scroll_marathi_days INTEGER,
        scroll_marathi_rate NUMERIC(10,2),
        video_kannada_days INTEGER,
        video_kannada_rate NUMERIC(10,2),
        video_marathi_days INTEGER,
        video_marathi_rate NUMERIC(10,2),
        video_creative_charges NUMERIC(10,2),
        include_gst BOOLEAN NOT NULL DEFAULT TRUE,
        cgst_percent NUMERIC(5,2) NOT NULL DEFAULT 9,
        sgst_percent NUMERIC(5,2) NOT NULL DEFAULT 9,
        subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
        cgst_amount NUMERIC(12,2),
        sgst_amount NUMERIC(12,2),
        total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        commission_amount NUMERIC(12,2),
        status TEXT NOT NULL DEFAULT 'draft',
        sent_at TIMESTAMP,
        approved_at TIMESTAMP,
        paid_at TIMESTAMP,
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        payment_mode TEXT NOT NULL,
        payment_reference TEXT,
        payment_date TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL,
        related_id INTEGER,
        related_type TEXT,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`
    ];

    for (const q of createTablesQueries) {
      await pool.query(q);
    }

    // Seed default users if empty
    const res = await pool.query("SELECT COUNT(*) FROM users;");
    const count = parseInt(res.rows[0]?.count || "0", 10);
    if (count === 0) {
      const usersToInsert = [
        {
          username: "admin",
          name: "Rajashekar Patil (Management)",
          email: "admin@innews24x7.com",
          phone: "+91 98450 11111",
          passwordHash: hashPassword("admin123"),
          role: "management" as const,
          isActive: true,
        },
        {
          username: "ops1",
          name: "Prakash Shinde (Operations)",
          email: "ops@innews24x7.com",
          phone: "+91 98450 22222",
          passwordHash: hashPassword("ops123"),
          role: "operations" as const,
          isActive: true,
        },
        {
          username: "coord1",
          name: "Suresh Pujari (Coordinator)",
          email: "coord@innews24x7.com",
          phone: "+91 98450 33333",
          passwordHash: hashPassword("coord123"),
          role: "coordinator" as const,
          isActive: true,
        },
        {
          username: "sales1",
          name: "Mahesh Kulkarni (Sales)",
          email: "sales@innews24x7.com",
          phone: "+91 98450 44444",
          passwordHash: hashPassword("sales123"),
          role: "sales" as const,
          isActive: true,
        },
      ];
      await db.insert(schema.usersTable).values(usersToInsert);

      // Seed Clients
      const clientsToInsert = [
        {
          name: "KLE Society & Hospitals",
          contactPerson: "Dr. Prabhakar Kore",
          address: "JNMC Campus, Nehru Nagar, Belagavi, KA 590010",
          phone: "0831-2470000",
          email: "info@klehospitals.org",
          gstNumber: "29AAATK0123A1Z1",
          notes: "Key healthcare advertiser",
        },
        {
          name: "Belagavi Toyota & Motors",
          contactPerson: "Santosh Patil",
          address: "Khanapur Road, Tilakwadi, Belagavi, KA 590006",
          phone: "0831-2401111",
          email: "contact@belagavitoyota.com",
          gstNumber: "29AABCB5678B1Z2",
          notes: "Automobile ad campaigns",
        },
        {
          name: "Malabar Gold & Diamonds",
          contactPerson: "Vikram Shetty",
          address: "College Road, Belagavi, KA 590001",
          phone: "0831-2489999",
          email: "belagavi@malabargold.com",
          gstNumber: "29AACCM9012C1Z3",
          notes: "Festive Season Promotions",
        },
      ];
      await db.insert(schema.clientsTable).values(clientsToInsert);

      // Seed Agencies
      const agenciesToInsert = [
        {
          name: "North Karnataka Media Agency",
          type: "agency" as const,
          contactPerson: "Ramesh Naik",
          phone: "9845012345",
          email: "ramesh@nkmedia.com",
          commissionPercent: "15.00",
        },
        {
          name: "Prakash Associates",
          type: "freelancer" as const,
          contactPerson: "Prakash Joshi",
          phone: "9880198765",
          email: "prakash@freelance.in",
          commissionPercent: "10.00",
        },
      ];
      await db.insert(schema.agenciesTable).values(agenciesToInsert);

      // Seed Release Orders
      const roToInsert = [
        {
          roNumber: "RO/2025/0001",
          clientId: 1,
          agencyId: 1,
          status: "active" as const,
          roDate: "2026-07-01",
          clientRoReference: "KLE/AD/2026/07",
          publishFrom: "2026-07-01",
          publishTo: "2026-07-31",
          scrollKannada: true,
          scrollMarathi: true,
          audioVideoKannada: false,
          audioVideoMarathi: false,
          repeatTimes: 10,
          spotType: "scroll",
          spotDuration: "ticker",
          ratePerDay: "500.00",
          bonusSpots: 2,
          mediaDesignRequired: false,
          notes: "Run ticker in prime time bulletin",
          createdBy: 4,
          approvedBy: 1,
        },
        {
          roNumber: "RO/2025/0002",
          clientId: 2,
          agencyId: 2,
          status: "pending_approval" as const,
          roDate: "2026-07-15",
          clientRoReference: "TOYOTA/JULY/01",
          publishFrom: "2026-07-15",
          publishTo: "2026-08-15",
          scrollKannada: false,
          scrollMarathi: false,
          audioVideoKannada: true,
          audioVideoMarathi: false,
          repeatTimes: 6,
          spotType: "prime",
          spotDuration: "30s",
          ratePerDay: "1200.00",
          bonusSpots: 1,
          mediaDesignRequired: true,
          notes: "Fortuner launch event spot",
          createdBy: 4,
        },
        {
          roNumber: "RO/2025/0003",
          clientId: 3,
          agencyId: null,
          status: "approved" as const,
          roDate: "2026-07-10",
          clientRoReference: "MGD/RO/99",
          publishFrom: "2026-07-10",
          publishTo: "2026-07-25",
          scrollKannada: true,
          scrollMarathi: false,
          audioVideoKannada: false,
          audioVideoMarathi: true,
          repeatTimes: 8,
          spotType: "regular",
          spotDuration: "15s",
          ratePerDay: "800.00",
          bonusSpots: 0,
          mediaDesignRequired: false,
          notes: "Aashadha special offer",
          createdBy: 2,
          approvedBy: 1,
        },
      ];
      await db.insert(schema.releaseOrdersTable).values(roToInsert);

      // Seed Playout Report
      const playoutToInsert = [
        {
          releaseOrderId: 1,
          reportDate: "2026-07-21",
          publishFrom: "2026-07-01",
          publishTo: "2026-07-31",
          totalSpotsScheduled: 310,
          totalSpotsAired: 310,
          scrollKannadaDays: 31,
          scrollMarathiDays: 31,
          discrepancyNote: "All scheduled scrolls played accurately without delay.",
          status: "submitted" as const,
          createdBy: 3,
        },
      ];
      await db.insert(schema.playoutReportsTable).values(playoutToInsert);

      // Seed Invoice
      const invoiceToInsert = [
        {
          invoiceNumber: "IN/2025-26/001",
          clientId: 1,
          releaseOrderId: 1,
          playoutReportId: 1,
          agencyId: 1,
          roReference: "RO/2025/0001",
          publishFrom: "2026-07-01",
          publishTo: "2026-07-31",
          scrollKannadaDays: 31,
          scrollKannadaRate: "500.00",
          scrollMarathiDays: 31,
          scrollMarathiRate: "500.00",
          includeGst: true,
          cgstPercent: "9.00",
          sgstPercent: "9.00",
          subtotal: "31000.00",
          cgstAmount: "2790.00",
          sgstAmount: "2790.00",
          totalAmount: "36580.00",
          paidAmount: "0.00",
          commissionAmount: "4650.00",
          status: "sent" as const,
          createdBy: 2,
        },
      ];
      await db.insert(schema.invoicesTable).values(invoiceToInsert);

      // Seed Notifications
      const notificationsToInsert = [
        {
          userId: 1,
          message: "New Release Order RO/2025/0002 requires your approval",
          type: "ro_expiring" as const,
          relatedId: 2,
          relatedType: "release_order",
          isRead: false,
        },
        {
          userId: 2,
          message: "Playout report submitted for RO/2025/0001. Ready for invoicing.",
          type: "playout_report_ready" as const,
          relatedId: 1,
          relatedType: "playout_report",
          isRead: false,
        },
        {
          userId: 3,
          message: "RO/2025/0001 is active. Ensure daily playout logging.",
          type: "ro_approved" as const,
          relatedId: 1,
          relatedType: "release_order",
          isRead: true,
        },
      ];
      await db.insert(schema.notificationsTable).values(notificationsToInsert);
    }
  } catch (err) {
    console.error("Error initializing database schema/seed:", err);
  }
}

export * from "./schema";
