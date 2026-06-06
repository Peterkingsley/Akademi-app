import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  TextInput,
} from "react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Copy, Highlighter, MessageSquare } from "lucide-react-native";

interface SelectableTextProps {
  content: string;
  onAskAkademi: (selectedText: string) => void;
  onHighlight?: (selectedText: string) => void;
}

const formatDisplayText = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const SelectableText: React.FC<SelectableTextProps> = ({
  content,
  onAskAkademi,
  onHighlight,
}) => {
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const displayContent = formatDisplayText(content);

  const handleSelectionChange = (event: any) => {
    const { start, end } = event.nativeEvent.selection;
    if (start !== end) {
      setSelection({ start, end });
      // In a real app, we would calculate coordinates.
      // For now, we'll show a centered menu or a bottom bar.
      setMenuVisible(true);
    } else {
      setMenuVisible(false);
    }
  };

  const getSelectedText = () => {
    return displayContent.substring(selection.start, selection.end);
  };

  const handleCopy = () => {
    // Clipboard logic
    setMenuVisible(false);
  };

  const handleHighlightAction = () => {
    if (onHighlight) onHighlight(getSelectedText());
    setMenuVisible(false);
  };

  const handleAskAction = () => {
    onAskAkademi(getSelectedText());
    setMenuVisible(false);
  };

  return (
    <View style={styles.container}>
      <TextInput
        multiline
        editable={false}
        scrollEnabled={false}
        value={displayContent}
        style={[styles.textInput, typography.body]}
        onSelectionChange={handleSelectionChange}
        contextMenuHidden={true} // Hide native menu to show ours
      />

      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.menuContainer}>
              <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
                <Copy size={18} color="#FFFFFF" />
                <Text style={styles.menuText}>Copy</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.menuItem} onPress={handleHighlightAction}>
                <Highlighter size={18} color="#FFFFFF" />
                <Text style={styles.menuText}>Highlight</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.menuItem} onPress={handleAskAction}>
                <MessageSquare size={18} color="#FFFFFF" />
                <Text style={styles.menuText}>Ask Akademi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  textInput: {
    color: "#FFFFFF",
    lineHeight: 24,
    padding: 0,
    margin: 0,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  menuContainer: {
    flexDirection: "row",
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  menuText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    width: 1,
    height: "100%",
    backgroundColor: "#48484A",
    marginHorizontal: 4,
  },
});
