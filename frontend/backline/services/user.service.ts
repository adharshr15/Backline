// services/user.service.ts
import api from './api';
import { User } from '@/context/AuthContext';

interface UpdateUserPayload {
  name?: string;
  bio?: string;
  city?: string;
  state?: string;
  country?: string;
  profileImage?: string | null; // local URI for RN ImagePicker
  headerImage?: string | null;
}

export const updateMe = async (data: {
  name: string;
  bio?: string;
  city?: string;
  state?: string;
  country?: string;
  profileImage?: string | null;
  headerImage?: string | null;
}) => {
  const formData = new FormData();

  formData.append('name', data.name);
  if (data.bio) formData.append('bio', data.bio);
  if (data.city) formData.append('city', data.city);
  if (data.state) formData.append('state', data.state);
  if (data.country) formData.append('country', data.country);

  // ONLY append if it's a NEW file
  if (data.profileImage?.startsWith('file://')) {
    formData.append('profileImage', {
      uri: data.profileImage,
      name: 'profile.jpg',
      type: 'image/jpeg',
    } as any);
  }

  console.log("In user.service, data.headerImage", data.headerImage)

  if (data.headerImage?.startsWith('file://')) {
    formData.append('headerImage', {
      uri: data.headerImage,
      name: 'header.jpg',
      type: 'image/jpeg',
    } as any);
  }


  const response = await api.put('/users/me', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};