import { View, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";

type ViewMode = "poster" | "list";

interface ViewSwitcherProps {
  view: ViewMode;
  setView: (view: ViewMode) => void;
}

export default function ViewSwitcher({ view, setView }: ViewSwitcherProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: view === "poster" ? 0 : 1,
      useNativeDriver: true,
    }).start();
  }, [view]);

  const sliderTranslate = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 38], 
  });

  return (
    <View style={styles.container}>
      {/* sliding pill */}
      <Animated.View
        style={[
          styles.slider,
          { transform: [{ translateX: sliderTranslate }] },
        ]}
      />

      {/* poster */}
      <TouchableOpacity style={styles.tab} onPress={() => setView("poster")}>
        <Ionicons
          name="reader-outline"
          size={16}
          color={"white"}
        />
      </TouchableOpacity>

      {/* list */}
      <TouchableOpacity style={styles.tab} onPress={() => setView("list")}>
        <Ionicons
          name="list-outline"
          size={16}
          color={"white"}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#2a2a2a", 
    borderRadius: 20,
    padding: 2,
    width: 80,
    height: 32,
    position: "relative",
    marginBottom: 4,
    marginTop: -8
  },

  tab: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },

  slider: {
    position: "absolute",
    width: 36,
    height: 28,
    backgroundColor: "#535353", // active tab = light
    borderRadius: 16,
    top: 2,
    left: 2,
  },
});