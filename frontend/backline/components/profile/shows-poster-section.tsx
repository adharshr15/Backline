import { View, TouchableOpacity, StyleSheet } from "react-native";
import ViewSwitcher from "../ui/view-switcher";
import { ShowCarousel } from "../show-carousel";
import { ShowListView } from "../show-list-view";
import { Show } from "@/services/show.service";
import { ThemedText } from "../themed-text";

type ViewMode = "poster" | "list";

interface ProfileShowsSectionProps {
  showView: ViewMode;
  setShowView: (view: ViewMode) => void;
  shows: Show[];
  pastShows: Show[];
  showingPast: boolean;
  isOwner: boolean;
  onSeePastShows: () => void;
  onCreateShow: () => void;
  onEditShow: (show: Show) => void;
  activeProfileId?: string;
  activeProfileType?: 'user' | 'band' | 'venue';
  onRepost?: (show: Show) => void;
  onRsvp?: (show: Show) => void;
}

export default function ProfileShowsSection({
  showView,
  setShowView,
  shows,
  pastShows,
  showingPast,
  isOwner,
  onSeePastShows,
  onCreateShow,
  onEditShow,
  activeProfileId,
  activeProfileType,
  onRepost,
  onRsvp,
}: ProfileShowsSectionProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.switcherRow, !isOwner && { justifyContent: 'flex-end' }]}>
        {isOwner && (
          <TouchableOpacity style={styles.newShowBtn} onPress={onCreateShow}>
            <ThemedText style={styles.newShowText}>+ New Show</ThemedText>
          </TouchableOpacity>
        )}
        <ViewSwitcher view={showView} setView={setShowView} />
      </View>

      {showView === 'poster' ? (
        <ShowCarousel
          isOwner={isOwner}
          shows={shows}
          pastShows={pastShows}
          showingPast={showingPast}
          onSeePastShows={onSeePastShows}
          onCreateShow={onCreateShow}
          onEditShow={onEditShow}
          activeProfileId={activeProfileId}
          activeProfileType={activeProfileType}
          onRepost={onRepost}
          onRsvp={onRsvp}
        />
      ) : (
        <ShowListView
          isOwner={isOwner}
          shows={shows}
          pastShows={pastShows}
          showingPast={showingPast}
          onSeePastShows={onSeePastShows}
          activeProfileId={activeProfileId}
          activeProfileType={activeProfileType}
          onRepost={onRepost}
          onRsvp={onRsvp}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: -32,
  },
  switcherRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 32,
    marginBottom: 8,
    gap: 10,
  },
  newShowBtn: {
    height: 32,
    paddingHorizontal: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    justifyContent: 'center',
    marginBottom: 4,
    marginTop: -8,
  },
  newShowText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});
