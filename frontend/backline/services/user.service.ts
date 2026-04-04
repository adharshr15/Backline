// services/user.service.ts
import api from './api';

export const updateMe = async (data: {
  name: string;
  username: string;
  bio?: string;
  city?: string;
  state?: string;
  country?: string;
  profileImage?: string | null;
  headerImage?: string | null;
}) => {
  const formData = new FormData();

  if (data.name) formData.append('name', data.name);
  if (data.username) formData.append('username', data.username);
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