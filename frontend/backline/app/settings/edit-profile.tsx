import { useAuth } from '@/context/AuthContext';
import { EditUserProfileModal } from './edit-user-profile';
import { EditBandProfileModal } from './edit-band-profile';
import { EditVenueProfileModal } from './edit-venue-profile';

export default function EditProfileModal({ onClose }: { onClose: () => void }) {
    const { activeProfile } = useAuth();

    if (activeProfile?.accountType === 'BAND') return <EditBandProfileModal onClose={onClose} />;
    if (activeProfile?.accountType === 'VENUE') return <EditVenueProfileModal onClose={onClose} />;
    return <EditUserProfileModal onClose={onClose} />;
}
