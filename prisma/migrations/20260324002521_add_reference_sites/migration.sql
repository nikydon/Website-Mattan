-- CreateTable
CREATE TABLE "reference_sites" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "influence" INTEGER NOT NULL DEFAULT 0,
    "design_tokens" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_sites_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "reference_sites" ADD CONSTRAINT "reference_sites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
