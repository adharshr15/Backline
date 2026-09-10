import { StyleSheet} from 'react-native';
import { useAuth} from '@/context/AuthContext'
import { ThemedText } from '@/components/themed-text';
import { UserProfile } from '../../profile/user-profile';
import { BandProfile } from '../../profile/band-profile';
import { VenueProfile } from '../../profile/venue-profile';

export const AVATAR_SIZE = 80;
const BORDER_WIDTH = 3;

export const renderBioWithLinks = (text: string, setWebViewUrl: any) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, index) => {
    const isLink = part.match(urlRegex);

    if (isLink) {
      return (
        <ThemedText
          key={index}
          style={profileStyles.linkText}
          onPress={() => setWebViewUrl(part)}
        >
          {part.replace(/^https?:\/\//, '')}
        </ThemedText>
      );
    }

    return (
      <ThemedText key={index} style={profileStyles.bioText}>
        {part}
      </ThemedText>
    );
  });
};

type Tab = 'shows' | 'listings';

export default function ProfileScreen() {
  const { activeProfile } = useAuth();

  if (activeProfile?.accountType === 'BAND') return <BandProfile />;
  if (activeProfile?.accountType === 'VENUE') return <VenueProfile />;
  return <UserProfile />;
}

export const profileStyles = StyleSheet.create({
  pfpContainer: {
    position: 'absolute',
    top: -(AVATAR_SIZE / 2),
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  pfpWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 18,
    borderWidth: BORDER_WIDTH,
    borderColor: '#ffffff',
    overflow: 'hidden',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: 'white',
    marginTop: -2,
  },
  bioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: -10,
    marginBottom: -8
  },
  bioContainer: {
    alignItems: 'center',
    marginTop: -16,
  },
  linkText: {
    fontSize: 12,
    color: '#4A90D9',
    textDecorationLine: 'underline',
  },
  bioText: {
    fontSize: 12,
    color: 'grey',
    alignContent: 'center'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -32,
  },
  metaText: {
    fontSize: 11,
    opacity: 0.6,
    textAlign: 'center',
  },
  emptyText: {
    opacity: 0.4,
    fontSize: 13,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  modalUrl: {
    flex: 1,
    fontSize: 13,
    opacity: 0.6,
    marginRight: 12,
  },
  closeText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '600',
  },
  webView: {
    flex: 1,
  },
  switcherContainer: { flex: 1, backgroundColor: 'black' },
  switcherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  switcherTitle: { fontSize: 16, fontWeight: '600' },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  switcherRowActive: { opacity: 0.5 },
  switcherAvatar: { width: 44, height: 44, borderRadius: 12 },
  switcherName: { fontSize: 15, fontWeight: '600' },
  switcherSub: { fontSize: 12, opacity: 0.5 },
  createRow: { padding: 16 },
  createText: { fontSize: 15, color: '#4A90D9' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 45,
    backgroundColor: '#282828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 20,
  },
  headerGear: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
