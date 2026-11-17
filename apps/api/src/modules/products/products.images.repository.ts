import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { Executor } from '../../db';
import { productImages, products } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { publicImageColumns, type ImagesByProduct, type PublicImage } from './products.resource';

export type NewProductImage = {
  productId: string;
  imageKey: string;
  imageUrl: string;
  thumbKey: string;
  thumbUrl: string;
  fileName: string;
  size: number;
  width: number;
  height: number;
  createdById: string | null;
};

const displayOrder = [asc(productImages.sortOrder), asc(productImages.createdAt)] as const;

export class ProductImagesRepository {
  constructor(
    private db: Executor,
    private tenantId: string,
  ) {}

  private ofProduct(productId: string) {
    return and(eq(productImages.productId, productId), tenantEq(productImages, this.tenantId));
  }

  findProduct(productId: string) {
    return this.db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), tenantEq(products, this.tenantId)))
      .limit(1)
      .then((r) => r[0]);
  }

  // Serializes every image write of one product: the maximum and the single featured image are
  // checked and written under this lock.
  lockProduct(productId: string) {
    return this.db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), tenantEq(products, this.tenantId)))
      .for('update')
      .then((r) => r[0]);
  }

  count(productId: string) {
    return this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(productImages)
      .where(this.ofProduct(productId))
      .then((r) => r[0]?.n ?? 0);
  }

  listKeys(productId: string) {
    return this.db
      .select({
        id: productImages.id,
        imageKey: productImages.imageKey,
        thumbKey: productImages.thumbKey,
      })
      .from(productImages)
      .where(this.ofProduct(productId));
  }

  listByProduct(productId: string): Promise<PublicImage[]> {
    return this.db
      .select(publicImageColumns)
      .from(productImages)
      .where(this.ofProduct(productId))
      .orderBy(...displayOrder);
  }

  async listAll(): Promise<ImagesByProduct> {
    const rows = await this.db
      .select(publicImageColumns)
      .from(productImages)
      .where(tenantEq(productImages, this.tenantId))
      .orderBy(...displayOrder);
    const byProduct = new Map<string, PublicImage[]>();
    for (const row of rows) {
      const list = byProduct.get(row.productId);
      if (list) list.push(row);
      else byProduct.set(row.productId, [row]);
    }
    return byProduct;
  }

  // Appended after the last image; featured when the product has none yet.
  async insert(data: NewProductImage) {
    const [state] = await this.db
      .select({
        next: sql<number>`coalesce(max(${productImages.sortOrder}) + 1, 0)::int`,
        hasFeatured: sql<boolean>`coalesce(bool_or(${productImages.isFeatured}), false)`,
      })
      .from(productImages)
      .where(this.ofProduct(data.productId));
    const [row] = await this.db
      .insert(productImages)
      .values({
        ...data,
        sortOrder: state?.next ?? 0,
        isFeatured: !state?.hasFeatured,
        tenantId: this.tenantId,
      })
      .returning(publicImageColumns);
    return row!;
  }

  delete(productId: string, imageId: string) {
    return this.db
      .delete(productImages)
      .where(and(eq(productImages.id, imageId), this.ofProduct(productId)))
      .returning({
        imageKey: productImages.imageKey,
        thumbKey: productImages.thumbKey,
        isFeatured: productImages.isFeatured,
      })
      .then((r) => r[0]);
  }

  // Gives the featured mark to the first image in display order, if any is left.
  async featureFirst(productId: string) {
    const [first] = await this.db
      .select({ id: productImages.id })
      .from(productImages)
      .where(this.ofProduct(productId))
      .orderBy(...displayOrder)
      .limit(1);
    if (!first) return;
    await this.db
      .update(productImages)
      .set({ isFeatured: true })
      .where(and(eq(productImages.id, first.id), this.ofProduct(productId)));
  }

  // The previous featured image is cleared first: the partial unique index allows only one.
  async setFeatured(productId: string, imageId: string) {
    await this.db
      .update(productImages)
      .set({ isFeatured: false })
      .where(
        and(
          this.ofProduct(productId),
          eq(productImages.isFeatured, true),
          ne(productImages.id, imageId),
        ),
      );
    return this.db
      .update(productImages)
      .set({ isFeatured: true })
      .where(and(eq(productImages.id, imageId), this.ofProduct(productId)))
      .returning({ id: productImages.id })
      .then((r) => r[0]);
  }

  async reorder(productId: string, ids: readonly string[]) {
    await Promise.all(
      ids.map((id, index) =>
        this.db
          .update(productImages)
          .set({ sortOrder: index })
          .where(and(eq(productImages.id, id), this.ofProduct(productId))),
      ),
    );
  }
}
