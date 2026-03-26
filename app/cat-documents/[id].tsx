import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "@/lib/supabase";

type CatRow = {
  id: string;
  name: string | null;
  call_name: string | null;
};

type CatDocumentRow = {
  id: string;
  cat_id: string;
  document_type: string | null;
  document_number: string | null;
  issue_date: string | null;
  file_url: string | null;
  notes: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "brak daty";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function normalizeType(value: string | null) {
  return (value || "").trim().toLowerCase();
}

function isPedigreeType(value: string | null) {
  const v = normalizeType(value);
  return [
    "rodowód",
    "rodowod",
    "pedigree",
    "fpl_pedigree",
    "rodowod_fpl",
  ].includes(v);
}

function isDiplomaType(value: string | null) {
  const v = normalizeType(value);
  return [
    "dyplom",
    "dyplomy",
    "diploma",
    "title_diploma",
    "championship_diploma",
    "tytuł",
    "tytul",
  ].includes(v);
}

function shouldShowCallName(name?: string | null, callName?: string | null) {
  const n = (name || "").trim().toLowerCase();
  const c = (callName || "").trim().toLowerCase();

  if (!c) return false;
  if (!n) return true;

  const words = n
    .split(/[^\p{L}\p{N}]+/u)
    .map((x) => x.trim())
    .filter(Boolean);

  return !words.includes(c);
}

function DocumentRow({
  item,
  accentColor,
  onDelete,
}: {
  item: CatDocumentRow;
  accentColor: string;
  onDelete: (id: string, type: string) => void;
}) {
  const openFile = async () => {
    if (!item.file_url) return;

    try {
      const supported = await Linking.canOpenURL(item.file_url);
      if (supported) {
        await Linking.openURL(item.file_url);
      }
    } catch (error) {
      console.error("Document open error:", error);
    }
  };

  const hasLink = !!item.file_url;
  const title =
    item.document_number?.trim() ||
    item.document_type?.trim() ||
    "Dokument bez nazwy";

  return (
    <View style={styles.docRow}>
      <View style={styles.docMain}>
        <View style={[styles.dot, { backgroundColor: accentColor }]} />

        <View style={styles.docTextWrap}>
          {hasLink ? (
            <Pressable onPress={openFile}>
              <Text style={styles.docTitleLink}>{title}</Text>
            </Pressable>
          ) : (
            <Text style={styles.docTitle}>{title}</Text>
          )}

          <Text style={styles.docMeta}>
            Typ: {item.document_type?.trim() || "brak danych"}
          </Text>

          <Text style={styles.docMeta}>
            Data: {formatDate(item.issue_date)}
          </Text>

          {item.notes?.trim() ? (
            <Text style={styles.docNotes}>{item.notes.trim()}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onDelete(item.id, item.document_type || "inne")}
        >
          <Text style={styles.deleteBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DocumentSection({
  title,
  items,
  emptyText,
  accentColor,
  onAddClick,
  onDelete,
}: {
  title: string;
  items: CatDocumentRow[];
  emptyText: string;
  accentColor: string;
  onAddClick: () => void;
  onDelete: (id: string, type: string) => void;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCount}>{items.length}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: accentColor }]}
          onPress={onAddClick}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        items.map((item) => (
          <DocumentRow
            key={item.id}
            item={item}
            accentColor={accentColor}
            onDelete={onDelete}
          />
        ))
      )}
    </View>
  );
}

export default function CatDocumentsScreen() {
  const { id } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [cat, setCat] = useState<CatRow | null>(null);
  const [documents, setDocuments] = useState<CatDocumentRow[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    setErrorText(null);

    try {
      const [catRes, docsRes] = await Promise.all([
        supabase
          .from("cats")
          .select("id, name, call_name")
          .eq("id", id)
          .single(),

        supabase
          .from("cat_documents")
          .select(
            "id, cat_id, document_type, document_number, issue_date, file_url, notes"
          )
          .eq("cat_id", id)
          .order("issue_date", { ascending: false, nullsFirst: false }),
      ]);

      if (catRes.error) throw catRes.error;
      if (docsRes.error) throw docsRes.error;

      setCat((catRes.data as CatRow) || null);
      setDocuments((docsRes.data as CatDocumentRow[]) || []);
    } catch (error) {
      console.error("Cat documents load error:", error);
      setErrorText("Nie udało się wczytać dokumentów kota.");
      setCat(null);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const pedigreeDocs = useMemo(
    () => documents.filter((x) => isPedigreeType(x.document_type)),
    [documents]
  );

  const diplomaDocs = useMemo(
    () => documents.filter((x) => isDiplomaType(x.document_type)),
    [documents]
  );

  const otherDocs = useMemo(
    () =>
      documents.filter(
        (x) =>
          !isPedigreeType(x.document_type) && !isDiplomaType(x.document_type)
      ),
    [documents]
  );

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name || "document",
          mimeType: asset.mimeType || "application/octet-stream",
        });
      }
    } catch (error) {
      console.error("Document picker error:", error);
      Alert.alert("Błąd", "Nie udało się wybrać pliku.");
    }
  };
    const resetModal = () => {
    setModalVisible(false);
    setSelectedDocType(null);
    setSelectedFile(null);
  };

        const uploadDocument = async () => {
    if (!selectedDocType) {
      Alert.alert("Błąd", "Wybierz typ dokumentu.");
      return;
    }

    if (!selectedFile) {
      Alert.alert("Błąd", "Wybierz plik do uploadu.");
      return;
    }

    if (!cat?.id) {
      Alert.alert("Błąd", "Kot nie został znaleziony.");
      return;
    }

    setUploading(true);

    try {
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const docType = selectedDocType.replace(/\s+/g, "_").toLowerCase();
      const filePath = `documents/${docType}/${fileName}`;

      console.log("🚀 Upload started:", filePath);

      const response = await fetch(selectedFile.uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      const blob = await response.blob();
      console.log("✅ Blob created:", blob.size, "bytes");

      console.log("📤 Uploading to Supabase...");
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("cats")
        .upload(filePath, blob, {
          contentType: selectedFile.mimeType || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.error("❌ Upload failed:", uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log("✅ Upload success:", uploadData);

      const { data: publicData } = supabase.storage
        .from("cats")
        .getPublicUrl(filePath);

      const fileUrl = publicData?.publicUrl || null;
      console.log("🔗 Public URL:", fileUrl);

      const { error: insertError } = await supabase
        .from("cat_documents")
        .insert({
          cat_id: id,
          cattery_id: id,
          document_type: selectedDocType,
          document_number: null,
          issue_date: null,
          file_url: fileUrl,
          notes: null,
        });

      if (insertError) {
        console.error("❌ Insert failed:", insertError);
        throw new Error(`Insert failed: ${insertError.message}`);
      }

      Alert.alert("Sukces", "Dokument został dodany.");
      resetModal();
      loadData();
    } catch (error: any) {
      console.error("❌ Full error:", error);
      Alert.alert("Błąd", error.message || "Nie udało się dodać dokumentu.");
    } finally {
      setUploading(false);
    }
  };

  
  const deleteDocument = (docId: string, docType: string) => {
    Alert.alert(
      "Usuń dokument",
      `Czy na pewno chcesz usunąć ten dokument (${docType})?`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Usuń",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("cat_documents")
                .delete()
                .eq("id", docId);
              if (error) throw error;
              loadData();
              Alert.alert("Sukces", "Dokument został usunięty.");
            } catch (error) {
              Alert.alert("Błąd", "Nie można usunąć dokumentu.");
            }
          },
        },
      ]
    );
  };

  const openAddDocumentModal = (docType: string) => {
    setSelectedDocType(docType);
    setModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Ładowanie dokumentów…</Text>
      </View>
    );
  }

  if (!cat) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>
          Nie udało się wczytać danych kota.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DOKUMENTY</Text>
        <Text style={styles.title}>{cat.name || "Kot"}</Text>

        {shouldShowCallName(cat.name, cat.call_name) ? (
          <Text style={styles.subtitle}>({cat.call_name})</Text>
        ) : null}
      </View>

      {errorText ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : null}

      <DocumentSection
        title="Rodowód"
        items={pedigreeDocs}
        emptyText="Brak dodanego rodowodu."
        accentColor="#6d597a"
        onAddClick={() => openAddDocumentModal("rodowód")}
        onDelete={deleteDocument}
      />

      <DocumentSection
        title="Dyplomy"
        items={diplomaDocs}
        emptyText="Brak dodanych dyplomów."
        accentColor="#b56576"
        onAddClick={() => openAddDocumentModal("dyplom")}
        onDelete={deleteDocument}
      />

      <DocumentSection
        title="Inne"
        items={otherDocs}
        emptyText="Brak innych dokumentów."
        accentColor="#355070"
        onAddClick={() => openAddDocumentModal("inne")}
        onDelete={deleteDocument}
      />

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Obsługiwane dokumenty</Text>
        <Text style={styles.infoText}>
          Możesz tu trzymać pliki PDF, JPG i inne formaty powiązane
          bezpośrednio z kotem. Kliknięcie w nazwę dokumentu otworzy plik,
          jeśli został dodany link.
        </Text>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={resetModal}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Dodaj {selectedDocType || "dokument"}
              </Text>
              <TouchableOpacity onPress={resetModal}>
                <Text style={styles.modalCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.filePickerBtn}
                onPress={pickDocument}
              >
                <Text style={styles.filePickerBtnText}>
                  {selectedFile ? "📎 " + selectedFile.name : "📎 Wybierz plik"}
                </Text>
              </TouchableOpacity>

              {selectedFile && (
                <TouchableOpacity
                  onPress={() => setSelectedFile(null)}
                  style={styles.fileClearBtn}
                >
                  <Text style={styles.fileClearBtnText}>Usuń plik</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={resetModal}
              >
                <Text style={styles.modalButtonText}>Anuluj</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  uploading && styles.modalSubmitBtnDisabled,
                ]}
                onPress={uploadDocument}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>Dodaj dokument</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7f4ee",
  },
  content: {
    paddingBottom: 28,
  },
  header: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.4,
    color: "#8f8a80",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  subtitle: {
    fontSize: 16,
    color: "#7b7469",
    marginTop: 4,
    fontWeight: "700",
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: "#f7f4ee",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#5b5b5b",
    textAlign: "center",
  },
  errorBox: {
    backgroundColor: "#fff1f1",
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#f2cccc",
  },
  errorText: {
    color: "#8b2d2d",
    fontSize: 14,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ece5d8",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  sectionCount: {
    minWidth: 32,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "800",
    color: "#5d574f",
    backgroundColor: "#f1ece3",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#7b7469",
  },
  docRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1ece3",
  },
  docMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    justifyContent: "space-between",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 7,
    flexShrink: 0,
  },
  docTextWrap: {
    flex: 1,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1f1f1f",
    marginBottom: 4,
  },
  docTitleLink: {
    fontSize: 15,
    fontWeight: "800",
    color: "#355070",
    marginBottom: 4,
    textDecorationLine: "underline",
  },
  docMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6f685f",
  },
  docNotes: {
    fontSize: 13,
    lineHeight: 19,
    color: "#5f594f",
    marginTop: 6,
  },
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    fontSize: 18,
  },
  infoCard: {
    backgroundColor: "#f0ebe3",
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#e2dacb",
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#26231f",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6e675d",
  },
  centeredView: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0d5cc",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f1f1f",
  },
  modalCloseBtn: {
    fontSize: 24,
    color: "#999",
  },
  modalContent: {
    marginBottom: 24,
    alignItems: "center",
  },
  filePickerBtn: {
    backgroundColor: "#f0ebe3",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#d4a574",
    alignItems: "center",
    width: "100%",
  },
  filePickerBtnText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#6a5f52",
  },
  fileClearBtn: {
    backgroundColor: "#ffe0e0",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    alignItems: "center",
  },
  fileClearBtnText: {
    fontSize: 13,
    color: "#8b2d2d",
    fontWeight: "600",
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#e0d5cc",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: "#d4a574",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalSubmitBtnDisabled: {
    opacity: 0.6,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "white",
  },
});
