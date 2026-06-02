import { useLocalSearchParams } from 'expo-router';
import ViewVenueProfile from '@/components/view-venue-profile';

export default function ViewVenueScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <ViewVenueProfile id={id!} />;
}
