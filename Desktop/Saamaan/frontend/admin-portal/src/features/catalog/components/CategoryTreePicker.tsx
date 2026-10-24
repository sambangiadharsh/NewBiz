import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  CheckCircle2,
  Tag,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../../../lib/axios.js';

interface RawCategory {
  categoryId: number;
  parentCategoryId: number | null;
  categoryName: string;
  categoryCode?: string;
  isLeaf: boolean;
  status: string;
}

interface TreeNode extends RawCategory {
  children: TreeNode[];
  path: string;
}

interface CategoryTreePickerProps {
  selectedCategoryId: string;
  onSelect: (categoryId: string, categoryName: string, path: string) => void;
  disabled?: boolean;
}

export const CategoryTreePicker: React.FC<CategoryTreePickerProps> = ({
  selectedCategoryId,
  onSelect,
  disabled = false,
}) => {
  const [categories, setCategories] = useState<RawCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  useEffect(() => {
    let isMounted = true;
    const fetchCats = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/categories');
        if (res.data?.success && isMounted) {
          const list: RawCategory[] = res.data.data || [];
          setCategories(list.filter((c) => c.status === 'ACTIVE'));
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchCats();
    return () => {
      isMounted = false;
    };
  }, []);

  // Build tree & full path
  const { rootNodes, categoryMap } = useMemo(() => {
    const map = new Map<number, TreeNode>();
    categories.forEach((cat) => {
      map.set(cat.categoryId, {
        ...cat,
        children: [],
        path: cat.categoryName,
      });
    });

    const roots: TreeNode[] = [];

    // Helper to calculate full breadcrumb path
    const getPath = (id: number): string => {
      const node = map.get(id);
      if (!node) return '';
      if (!node.parentCategoryId) return node.categoryName;
      const parentPath = getPath(node.parentCategoryId);
      return parentPath ? `${parentPath} > ${node.categoryName}` : node.categoryName;
    };

    map.forEach((node) => {
      node.path = getPath(node.categoryId);
      if (node.parentCategoryId && map.has(node.parentCategoryId)) {
        map.get(node.parentCategoryId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return { rootNodes: roots, categoryMap: map };
  }, [categories]);

  // Auto-expand ancestors when a category is selected
  useEffect(() => {
    if (!selectedCategoryId || categoryMap.size === 0) return;
    const current = categoryMap.get(Number(selectedCategoryId));
    if (!current) return;

    const toExpand = new Set(expandedNodes);
    let pId = current.parentCategoryId;
    while (pId && categoryMap.has(pId)) {
      toExpand.add(pId);
      pId = categoryMap.get(pId)!.parentCategoryId;
    }
    setExpandedNodes(toExpand);
  }, [selectedCategoryId, categoryMap]);

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered search list (direct leaf matches for quick selection)
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const lower = searchTerm.toLowerCase();
    const matches: TreeNode[] = [];
    categoryMap.forEach((node) => {
      if (
        node.isLeaf &&
        (node.categoryName.toLowerCase().includes(lower) ||
          node.path.toLowerCase().includes(lower) ||
          (node.categoryCode && node.categoryCode.toLowerCase().includes(lower)))
      ) {
        matches.push(node);
      }
    });
    return matches;
  }, [searchTerm, categoryMap]);

  const selectedNode = selectedCategoryId ? categoryMap.get(Number(selectedCategoryId)) : null;

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.categoryId);
    const hasChildren = node.children.length > 0;
    const isSelected = String(node.categoryId) === String(selectedCategoryId);

    return (
      <div key={node.categoryId} className="select-none">
        <div
          onClick={() => {
            if (node.isLeaf && !disabled) {
              onSelect(String(node.categoryId), node.categoryName, node.path);
            } else if (hasChildren) {
              toggleExpand(node.categoryId, { stopPropagation: () => {} } as any);
            }
          }}
          className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs transition-colors cursor-pointer ${
            isSelected
              ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
              : node.isLeaf
              ? 'hover:bg-slate-50 text-slate-800'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(node.categoryId, e)}
              className="p-0.5 hover:bg-slate-200/60 rounded text-slate-400 hover:text-slate-700"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-3.5 h-3.5" />
          )}

          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
            )
          ) : (
            <Tag
              className={`w-3.5 h-3.5 shrink-0 ${
                isSelected ? 'text-indigo-600' : 'text-slate-400'
              }`}
            />
          )}

          <span className="truncate flex-1">{node.categoryName}</span>

          {node.isLeaf ? (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                isSelected
                  ? 'bg-indigo-200/50 text-indigo-800'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              Leaf
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">
              ({node.children.length})
            </span>
          )}

          {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-slate-100 ml-4">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Selected Leaf Banner */}
      {selectedNode && (
        <div className="p-3 bg-gradient-to-r from-indigo-50/70 to-purple-50/50 border border-indigo-100 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <div className="truncate">
              <span className="text-slate-500 font-normal">Selected Category: </span>
              <span className="font-semibold text-slate-900">{selectedNode.categoryName}</span>
              <div className="text-[11px] text-indigo-600/80 truncate">{selectedNode.path}</div>
            </div>
          </div>
          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium shrink-0">
            Ready
          </span>
        </div>
      )}

      {/* Tree Selector Container */}
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
        {/* Search header */}
        <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={disabled || loading}
            placeholder="Search category name (e.g. Running Shoes, Cooker)..."
            className="w-full text-xs bg-transparent outline-none text-slate-800 placeholder-slate-400 py-1"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-[10px] text-slate-400 hover:text-slate-600 px-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Tree Body */}
        <div className="max-h-56 overflow-y-auto p-2 text-xs">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span>Loading category hierarchy...</span>
            </div>
          ) : searchResults !== null ? (
            searchResults.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                No leaf categories match &quot;{searchTerm}&quot;
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-400 px-2 pb-1">
                  Matching Leaf Categories ({searchResults.length}):
                </div>
                {searchResults.map((node) => {
                  const isSelected = String(node.categoryId) === String(selectedCategoryId);
                  return (
                    <div
                      key={node.categoryId}
                      onClick={() => {
                        if (!disabled) {
                          onSelect(String(node.categoryId), node.categoryName, node.path);
                        }
                      }}
                      className={`p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="truncate">
                        <div className="text-xs">{node.categoryName}</div>
                        <div className="text-[10px] text-slate-400 truncate">{node.path}</div>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : rootNodes.length === 0 ? (
            <div className="py-6 text-center text-slate-400">No categories found</div>
          ) : (
            <div className="space-y-0.5">
              {rootNodes.map((node) => renderNode(node, 0))}
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Products must be created under a leaf category to generate accurate specifications and variant attributes.
      </p>
    </div>
  );
};
