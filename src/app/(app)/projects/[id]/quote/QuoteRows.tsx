"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tr, Td } from "@/components/ui/table";
import { formatVND, formatNumber, formatQty } from "@/lib/utils";
import { lineSell } from "@/lib/quote";
import type { ItemView, SectionView } from "./types";

/** Các thao tác mà thân bảng cần gọi ngược lên thẻ báo giá. */
export interface RowHandlers {
  onAddSub: (phanId: string) => void;
  onEditSection: (s: SectionView) => void;
  onDeleteSection: (s: SectionView) => void;
  onAddItem: (sectionId: string) => void;
  onEditItem: (it: ItemView) => void;
  onDeleteItem: (it: ItemView) => void;
}

function ItemRows({
  items,
  canEdit,
  h,
}: {
  items: ItemView[];
  canEdit: boolean;
  h: RowHandlers;
}) {
  return (
    <>
      {items.map((it) => (
        <Tr key={it.id}>
          <Td className="font-mono text-xs text-slate-500">{it.workCode ?? "—"}</Td>
          <Td className="text-slate-900">
            {it.name}
            {it.bienTheTen ? (
              <span className="text-slate-500"> · {it.bienTheTen}</span>
            ) : null}
            {it.spec ? <span className="text-slate-400"> · {it.spec}</span> : null}
          </Td>
          <Td className="text-slate-600">{it.unit ?? "—"}</Td>
          <Td className="text-right">
            {formatQty(it.qty)}
            {/* Dấu tổng: khối lượng này do hệ thống cộng từ các dòng nguồn, không ai gõ. */}
            {it.layTuThamSo && (
              <span
                className="ml-1 text-slate-400"
                title={`Tự tính từ các dòng nạp "${it.layTuThamSo}" trong cùng phần`}
              >
                ∑
              </span>
            )}
          </Td>
          <Td className="text-right text-slate-500">
            {formatNumber(it.baseCost)}
            {/*
              Huy hiệu lệch giá hiện cho CẢ dòng đã sửa tay — người dùng vẫn cần biết
              thư viện đã đổi. Chỉ có việc "Cập nhật giá" là bỏ qua dòng đó.
            */}
            {it.coTroiGia && it.donGiaHienHanh !== null && (
              <span
                className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800"
                title={
                  it.giaSuaTay
                    ? "Thư viện đã đổi giá, nhưng dòng này đã sửa tay nên không tự cập nhật"
                    : "Thư viện đã đổi giá kể từ lúc chốt"
                }
              >
                → {formatNumber(it.donGiaHienHanh)}
              </span>
            )}
            {it.giaSuaTay && (
              <span
                className="ml-1.5 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600"
                title="Giá do người lập tự nhập, không theo thư viện"
              >
                sửa tay
              </span>
            )}
          </Td>
          <Td className="text-right">{formatNumber(it.sellPrice)}</Td>
          <Td className="text-right font-medium">{formatVND(lineSell(it))}</Td>
          {canEdit && (
            <Td className="text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => h.onEditItem(it)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => h.onDeleteItem(it)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Td>
          )}
        </Tr>
      ))}
    </>
  );
}

function AddItemRow({
  colSpan,
  label,
  onClick,
}: {
  colSpan: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tr>
      <Td colSpan={colSpan} className="py-1">
        <button className="text-xs text-blue-600 hover:underline" onClick={onClick}>
          + Thêm dòng vào {label}
        </button>
      </Td>
    </Tr>
  );
}

/**
 * Thân bảng báo giá: mỗi phần gốc, rồi dòng của nó, rồi từng mục con kèm dòng.
 * `tienPhan` do thẻ cha tính sẵn (đã gộp cả dòng của mục con).
 */
export function QuoteRows({
  sections,
  items,
  canEdit,
  tienPhan,
  h,
}: {
  sections: SectionView[];
  items: ItemView[];
  canEdit: boolean;
  tienPhan: (phanId: string) => number;
  h: RowHandlers;
}) {
  const colSpan = canEdit ? 8 : 7;
  const itemsBySection = new Map<string, ItemView[]>();
  for (const it of items) {
    if (!itemsBySection.has(it.sectionId)) itemsBySection.set(it.sectionId, []);
    itemsBySection.get(it.sectionId)!.push(it);
  }
  const phans = sections.filter((s) => !s.parentId);
  const subsOf = (phanId: string) => sections.filter((s) => s.parentId === phanId);

  if (sections.length === 0) {
    return (
      <Tr>
        <Td colSpan={colSpan} className="py-6 text-center text-slate-400">
          Chưa có phần nào.
        </Td>
      </Tr>
    );
  }

  return (
    <>
      {phans.map((phan) => (
        <PhanGroup key={phan.id}>
          <Tr className="bg-slate-100/80">
            <Td className="font-semibold text-slate-800">{phan.code}</Td>
            <Td className="font-semibold text-slate-800" colSpan={5}>
              {phan.name}
              {phan.area ? (
                <span className="text-slate-400"> · {formatNumber(phan.area)} m²</span>
              ) : null}
            </Td>
            <Td className="text-right font-semibold text-blue-700">
              {formatVND(tienPhan(phan.id))}
            </Td>
            {canEdit && (
              <Td className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => h.onAddSub(phan.id)}
                    title="Thêm mục con"
                    aria-label="Thêm mục con"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => h.onEditSection(phan)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => h.onDeleteSection(phan)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Td>
            )}
          </Tr>
          <ItemRows items={itemsBySection.get(phan.id) ?? []} canEdit={canEdit} h={h} />
          {canEdit && (
            <AddItemRow
              colSpan={colSpan}
              label={phan.code}
              onClick={() => h.onAddItem(phan.id)}
            />
          )}
          {subsOf(phan.id).map((sub) => (
            <PhanGroup key={sub.id}>
              <Tr className="bg-slate-50">
                <Td className="font-medium text-slate-600">{sub.code}</Td>
                <Td className="font-medium text-slate-600" colSpan={6}>
                  {sub.name}
                </Td>
                {canEdit && (
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => h.onEditSection(sub)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => h.onDeleteSection(sub)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Td>
                )}
              </Tr>
              <ItemRows items={itemsBySection.get(sub.id) ?? []} canEdit={canEdit} h={h} />
              {canEdit && (
                <AddItemRow
                  colSpan={colSpan}
                  label={`${phan.code}.${sub.code}`}
                  onClick={() => h.onAddItem(sub.id)}
                />
              )}
            </PhanGroup>
          ))}
        </PhanGroup>
      ))}
    </>
  );
}

function PhanGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
