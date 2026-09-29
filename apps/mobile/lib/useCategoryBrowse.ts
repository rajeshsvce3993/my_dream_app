import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './api';
import type { CategoryDoc } from '../components/categoryHierarchyUi';

export type CategoryBrowseResponse = {
  categories: CategoryDoc[];
  productLimit: number;
  subcategoryLimit: number;
  defaultSubcategorySlugByParent: Record<string, string>;
};

export function useCategoryBrowse(enabled = true) {
  return useQuery({
    queryKey: ['category-browse'],
    queryFn: () => apiRequest<CategoryBrowseResponse>('/catalog/category-browse'),
    staleTime: 60_000,
    enabled,
  });
}
