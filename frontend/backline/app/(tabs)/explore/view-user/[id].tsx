import { useLocalSearchParams } from 'expo-router';
import ViewUserProfile from '@/components/view-user-profile';

export default function ViewUserScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <ViewUserProfile id={id!} />;
}
