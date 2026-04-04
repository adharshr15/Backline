import { View, StyleSheet } from "react-native";
import ViewSwitcher from "../ui/view-switcher";
import { ShowCarousel } from "../show-carousel";

type ViewMode = "poster" | "list";

interface ProfileShowsSectionProps {
  showView: ViewMode;
  setShowView: (view: ViewMode) => void;
  shows: any[]; // replace with your Show type
  isOwner: boolean;
  onSeePastShows: () => void;
  onCreateShow: () => void;
}

export default function ProfileShowsSection({
  showView,
  setShowView,
  shows,
  isOwner,
  onSeePastShows,
  onCreateShow,
}: ProfileShowsSectionProps) {
  return (
    <View style={styles.container}>
      {/* top right switcher */}
      <View style={styles.switcherRow}>
        <ViewSwitcher view={showView} setView={setShowView} />
      </View>

      {/* carousel */}
      <ShowCarousel
        isOwner={isOwner}
        shows={shows}
        onSeePastShows={onSeePastShows}
        onCreateShow={onCreateShow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: -32,
  },
  switcherRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 32,
    marginBottom: 8,
  },
});