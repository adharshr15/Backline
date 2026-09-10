import { useLocalSearchParams } from 'expo-router';
import ViewBandProfile from '@/components/view-band-profile';

export default function ViewBandScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <ViewBandProfile id={id!} />;
}
