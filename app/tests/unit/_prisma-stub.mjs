// Minimal in-memory Prisma stub for unit tests. Mimics the subset of
// methods that src/lib/automation.ts (and other libs) use:
//   - default export = a global `prisma` object
//   - named export `PrismaClient` = a class whose constructor returns
//     a fresh `prisma` instance (so `new PrismaClient()` works)
//   - export `Prisma` namespace with empty enums (for type-only uses)
//
// Test code can inspect `prismaStubState` to assert what was persisted.

export const prismaStubState = {
  insights: [],
  businesses: new Map([
    // Pre-seed a valid business so the stub validates FK references.
    ["biz-1", { id: "biz-1", name: "Stub Business" }],
  ]),
  shouldFailCreate: false,
};

const capture = (op, args) => {
  if (op === "create" && args.data) {
    if (prismaStubState.shouldFailCreate) {
      throw new Error("FK constraint failed (simulated)");
    }
    // Validate businessId FK
    if (
      args.data.businessId &&
      !prismaStubState.businesses.has(args.data.businessId)
    ) {
      throw new Error(
        `Foreign key constraint violated: businessId '${args.data.businessId}' does not exist`
      );
    }
    const row = {
      id: `ins-${prismaStubState.insights.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      isRead: false,
      isActedOn: false,
      ...args.data,
    };
    prismaStubState.insights.push(row);
    return Promise.resolve(row);
  }
  return Promise.resolve(null);
};

const makeModel = (modelName) => ({
  create: (args) => capture("create", args),
  findUnique: (args) => {
    if (modelName === "business" && args.where?.id) {
      return Promise.resolve(
        prismaStubState.businesses.get(args.where.id) ?? null
      );
    }
    return Promise.resolve(null);
  },
  findFirst: (args) => {
    if (modelName === "business" && args.where?.id) {
      return Promise.resolve(
        prismaStubState.businesses.get(args.where.id) ?? null
      );
    }
    return Promise.resolve(null);
  },
  findMany: (args) => {
    if (modelName === "insight") {
      let rows = [...prismaStubState.insights];
      if (args?.where?.businessId) {
        rows = rows.filter((r) => r.businessId === args.where.businessId);
      }
      return Promise.resolve(rows);
    }
    return Promise.resolve([]);
  },
  update: (args) => {
    if (modelName === "insight" && args.where?.id) {
      const idx = prismaStubState.insights.findIndex((r) => r.id === args.where.id);
      if (idx >= 0) {
        prismaStubState.insights[idx] = { ...prismaStubState.insights[idx], ...args.data };
        return Promise.resolve(prismaStubState.insights[idx]);
      }
    }
    return Promise.resolve(null);
  },
  delete: (args) => {
    if (modelName === "insight" && args.where?.id) {
      const idx = prismaStubState.insights.findIndex((r) => r.id === args.where.id);
      if (idx >= 0) {
        const [removed] = prismaStubState.insights.splice(idx, 1);
        return Promise.resolve(removed);
      }
    }
    return Promise.resolve(null);
  },
  deleteMany: (args) => {
    if (modelName === "insight" && args?.where?.businessId) {
      const before = prismaStubState.insights.length;
      prismaStubState.insights = prismaStubState.insights.filter(
        (r) => r.businessId !== args.where.businessId
      );
      return Promise.resolve({ count: before - prismaStubState.insights.length });
    }
    return Promise.resolve({ count: 0 });
  },
  count: (args) => {
    if (modelName === "insight" && args?.where?.businessId) {
      return Promise.resolve(
        prismaStubState.insights.filter((r) => r.businessId === args.where.businessId).length
      );
    }
    return Promise.resolve(prismaStubState.insights.length);
  },
  upsert: (args) => {
    if (modelName === "business" && args?.where?.id) {
      const existing = prismaStubState.businesses.get(args.where.id);
      if (existing) return Promise.resolve({ ...existing, ...args.update });
      prismaStubState.businesses.set(args.where.id, { id: args.where.id, ...args.create });
      return Promise.resolve(prismaStubState.businesses.get(args.where.id));
    }
    return Promise.resolve(null);
  },
});

const buildClient = () => ({
  insight: makeModel("insight"),
  business: makeModel("business"),
  user: makeModel("user"),
  product: makeModel("product"),
  order: makeModel("order"),
  conversation: makeModel("conversation"),
  message: makeModel("message"),
  $disconnect: () => Promise.resolve(),
  $connect: () => Promise.resolve(),
});

// PrismaClient "class" — the constructor returns a fresh client instance.
// We attach common model accessors at construction time so `new PrismaClient()`
// produces something that mirrors the real API surface used by the app.
export class PrismaClient {
  constructor(_opts) {
    Object.assign(this, buildClient());
  }
}

// Default export mirrors a singleton, in case any code does
// `import prisma from "@prisma/client"`.
const defaultPrisma = buildClient();
export default defaultPrisma;
export { defaultPrisma as prisma };

// Empty Prisma namespace stub (used as `Prisma.JsonNull` etc.).
export const Prisma = new Proxy(
  {},
  {
    get: (_t, prop) => {
      // Return a Symbol for known enum-like names so the code compiles.
      if (typeof prop === "string") return prop;
      return undefined;
    },
  }
);
