import { apiFetch, apiFetchV1 } from '@/src/services/api/client';
import { Property, Unit } from '@/src/types';

export interface PropertyManagerOption {
  id: string;
  name: string;
  role: 'manager';
}

export const propertyService = {
  listManagers(): Promise<PropertyManagerOption[]> {
    return apiFetchV1<PropertyManagerOption[]>('/users');
  },

  listProperties(): Promise<Property[]> {
    return apiFetch<Property[]>('/properties');
  },

  listOperationalProperties(): Promise<Property[]> {
    return apiFetchV1<Property[]>('/properties');
  },

  getOperationalProperty(id: string): Promise<Property> {
    return apiFetchV1<Property>(`/properties/${id}`);
  },

  createProperty(payload: Partial<Property>): Promise<Property> {
    return apiFetchV1<Property>('/properties', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateProperty(id: string, payload: Partial<Property>): Promise<Property> {
    return apiFetchV1<Property>(`/properties/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  listUnits(): Promise<Unit[]> {
    return apiFetch<Unit[]>('/units');
  },

  listOperationalUnits(): Promise<Unit[]> {
    return apiFetchV1<Unit[]>('/units');
  },

  listOperationalPropertyUnits(propertyId: string): Promise<Unit[]> {
    return apiFetchV1<Unit[]>(`/properties/${propertyId}/units`);
  },

  createUnit(payload: Partial<Unit>): Promise<Unit> {
    if (!payload.propertyId) {
      throw new Error('A property is required to create a unit.');
    }
    return apiFetchV1<Unit>(`/properties/${payload.propertyId}/units`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateUnit(id: string, payload: Partial<Unit>): Promise<Unit> {
    return apiFetchV1<Unit>(`/units/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  archiveUnit(id: string): Promise<void> {
    return apiFetchV1<void>(`/units/${id}`, {
      method: 'DELETE',
    });
  },
};
