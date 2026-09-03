/* ==========================================================================
   Azure Cosmos DB data model + access facade
   --------------------------------------------------------------------------
   This platform is a browser-only prototype: there is no Azure account and
   no network call here. What this file IS: the real Cosmos document/container
   design the in-browser store now follows, plus a query facade shaped like
   the Cosmos SDK so every screen reads data the way it would against a real
   account. Swapping to @azure/cosmos is then confined to this one file.

   Design intent
   -------------
   * Tenant isolation is the partition strategy. Every tenant-owned container
     partitions on /tenantId, so a tenant's reads are single-partition and no
     query can accidentally span tenants (COSMOS.query REQUIRES a tenantId
     for those containers — see assertTenant below).
   * Rating configuration is stored as typed documents in ONE `config`
     container discriminated by docType, rather than a container per entity.
     Cosmos charges per container throughput, and these are all read together
     per tenant, so co-partitioning them is both cheaper and lets a screen
     load a tenant's whole rating configuration in one query.
   * Rating factors carry an open `values[]` array instead of fixed columns.
     Adding a factor, or giving an existing factor new value rows, is a
     document write — never a schema migration. That is the "supports future
     changes to rating factors without major schema changes" requirement.
   * Rate tables (the extracted, workbook-verified loss costs / ILFs / class
     factors) live in a SHARED container partitioned on /tableId, not on
     /tenantId. They are reference data every tenant rates against in this
     prototype; see tenants.html, which states this plainly.
   ========================================================================== */

const COSMOS_MODEL = {
  database: "veridex-rating",
  containers: {
    tenants: {
      partitionKey: "/id",
      why: "Small, read on every page load, one document per tenant — partitioning on id keeps each read single-partition.",
      docTypes: ["tenant"],
      source: "tenants",
    },
    config: {
      partitionKey: "/tenantId",
      why: "All of a tenant's rating configuration is read together, so co-partitioning it lets one query return the whole config for a tenant. docType discriminates.",
      docTypes: ["lob", "product", "ratingFactor", "ratingVersion", "discount", "surcharge", "fee", "formula"],
      source: { lob: "lobs", product: "products", ratingFactor: "ratingFactors", ratingVersion: "versions",
                discount: "discounts", surcharge: "surcharges", fee: "fees", formula: "savedFormulas" },
    },
    quotes: {
      partitionKey: "/tenantId",
      why: "Quotes are always listed and filtered within one tenant. High write volume, so it gets its own container away from config reads.",
      docTypes: ["quote"],
      source: "quotes",
    },
    calculations: {
      partitionKey: "/quoteId",
      why: "A premium calculation is only ever read for its own quote. Partitioning on quoteId keeps the rating trace next to the quote that produced it and lets a calculation grow large without bloating the quote document.",
      docTypes: ["calculation"],
      source: "calculations",
    },
    rateTables: {
      partitionKey: "/tableId",
      why: "Shared reference data, not tenant-owned. Partitioned by table so a factor lookup reads exactly one partition.",
      docTypes: ["rateTable"],
      shared: true,
      source: "_rateTables",
    },
  },
};

/* Which VX collections are tenant-partitioned. Anything not listed here is
   shared reference data (rate tables, states, counties, ZIPs, industry
   classes, coverage tree) — geography and filed rate data are not per-tenant
   in this prototype. */
const COSMOS_TENANT_SCOPED = new Set([
  "lobs", "products", "ratingFactors", "versions",
  "discounts", "surcharges", "fees", "savedFormulas", "quotes", "units",
  /* A tenant's own imported rate tables (Product Studio JSON import) — its
     own isolated copy, distinct from the shared platform tables
     rate-tables-registry.js reads for known engine-rated lines. */
  "tenantRateTables",
]);

const COSMOS = (() => {
  function tenantId() { return (typeof VX !== "undefined" && VX.activeTenantId) || null; }

  /* A tenant-partitioned container must never be queried without a partition
     key — that's what stops one tenant's screen showing another's rows. */
  function assertTenant(collection, tid) {
    if (COSMOS_TENANT_SCOPED.has(collection) && tid == null) {
      throw new Error(`Cross-partition read blocked: ${collection} is partitioned on /tenantId and requires a tenant`);
    }
  }

  /* The core read. Mirrors a Cosmos SQL query scoped to one partition:
       SELECT * FROM c WHERE c.tenantId = @tid [AND c.docType = @t] [AND ...] */
  function query(collection, opt) {
    opt = opt || {};
    const all = (typeof VX !== "undefined" && VX[collection]) || [];
    if (!COSMOS_TENANT_SCOPED.has(collection)) {
      return opt.where ? all.filter(opt.where) : all.slice();
    }
    const tid = opt.tenantId !== undefined ? opt.tenantId : tenantId();
    assertTenant(collection, tid);
    let rows = all.filter(d => d.tenantId === tid);
    if (opt.where) rows = rows.filter(opt.where);
    return rows;
  }

  /* Point read — id + partition key, the cheapest Cosmos operation. */
  function point(collection, id, tid) {
    const rows = query(collection, { tenantId: tid });
    return rows.find(d => String(d.id) === String(id)) || null;
  }

  /* Tenant → LOB → Product hierarchy, the platform's primary navigation
     spine. Each level is scoped by the one above it. */
  function lobsFor(tid) {
    return query("lobs", { tenantId: tid === undefined ? tenantId() : tid });
  }
  function productsFor(lobName, tid) {
    return query("products", { tenantId: tid === undefined ? tenantId() : tid,
      where: p => !lobName || p.lob === lobName });
  }
  function factorsFor(lobName, tid) {
    return query("ratingFactors", { tenantId: tid === undefined ? tenantId() : tid,
      where: f => !lobName || f.lob === lobName });
  }

  return { query, point, lobsFor, productsFor, factorsFor, tenantId,
           model: COSMOS_MODEL, tenantScoped: COSMOS_TENANT_SCOPED };
})();

/* Convenience used by the shell and grid adapter: the active tenant's slice
   of a collection, or the whole collection when it is shared reference data. */
function vxScoped(collection) {
  try { return COSMOS.query(collection, {}); }
  catch (e) { return []; }
}
