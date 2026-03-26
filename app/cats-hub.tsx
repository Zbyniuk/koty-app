import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

type CatRow = {
  id: string;
  name: string | null;
  call_name: string | null;
  sex: string | null;
  birth_date: string | null;
  is_external: boolean | null;
  color_name: string | null;
  ems: string | null;
  main_photo_url: string | null;
  photo_url: string | null;
};

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

export default function CatsHubScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cats, setCats] = useState<CatRow[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const formatDate = (value: string | null) => {
    if (!value) return "brak daty";
    const [y, m, d] = value.split("-");
    if (!y || !m || !d) return value;
    return `${d}.${m}.${y}`;
  };

  const formatSex = (sex: string | null) => {
    if (sex === "F") return "KOTKA";
    if (sex === "M") return "KOCUR";
    return "KOT";
  };

  const getAppearance = (cat: CatRow) => {
    if (cat.color_name && cat.color_name.trim()) return cat.color_name;
    if (cat.ems && cat.ems.trim()) return cat.ems;
    return "brak umaszczenia";
  };

  const getPhoto = (cat: CatRow) => {
    if (cat.main_photo_url && cat.main_photo_url.trim()) return cat.main_photo_url;
    if (cat.photo_url && cat.photo_url.trim()) return cat.photo_url;
    return null;
  };

  const loadCats = useCallback(async () => {
    setErrorText(null);

    try {
      const { data, error } = await supabase
        .from("cats")
        .select("id, name, call_name, sex, birth_date, is_external, color_name, ems, main_photo_url, photo_url, status")
        .eq("status", "breeding")
        .eq("is_external", false)
        .order("name", { ascending: true });

      if (error) throw error;

      const sortedCats = ((data ?? []) as CatRow[]).sort((a, b) => {
        if (a.sex === b.sex) return (a.name || "").localeCompare(b.name || "");
        if (a.sex === "F") return -1;
        if (b.sex === "F") return 1;
        return 0;
      });

      setCats(sortedCats);
    } catch (error) {
      console.error("Cats hub load error:", error);
      setErrorText("Nie udało się wczytać listy kotów.");
    }
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    await loadCats();
    setLoading(false);
  }, [loadCats]);

  useFocusEffect(
    useCallback(() => {
      loadInitial();
    }, [loadInitial])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCats();
    setRefreshing(false);
  }, [loadCats]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Ładowanie kotów…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>KOTY</Text>
        <Text style={styles.title}>Koty hodowlane</Text>
      </View>

      {errorText ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : null}

      <FlatList
        data={cats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => {
          const photo = getPhoto(item);

          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/cat/${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.titleWrap}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.name || "Kot"}
                  </Text>
                  {item.call_name && item.call_name !== item.name ? (
                    <Text style={styles.cardCallName} numberOfLines={1}>
                      ({item.call_name})
                    </Text>
                  ) : null}
                </View>

                <Text style={styles.badge}>{formatSex(item.sex)}</Text>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.photoWrap}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.photo} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>🐾</Text>
                    </View>
                  )}
                </View>

                <View style={styles.infoWrap}>
                  <Text style={styles.cardSub} numberOfLines={2}>
                    {getAppearance(item)}
                  </Text>

                  <Text style={styles.cardSub}>
                    ur. {formatDate(item.birth_date)}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Brak kotów hodowlanych</Text>
            <Text style={styles.emptyText}>
              Gdy pojawią się rekordy ze statusem breeding, zobaczysz je tutaj.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7f4ee",
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
  loadingWrap: {
    flex: 1,
    backgroundColor: "#f7f4ee",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#5b5b5b",
  },
  errorBox: {
    backgroundColor: "#fff1f1",
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f2cccc",
  },
  errorText: {
    color: "#8b2d2d",
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ece5d8",
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  titleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: "#202020",
  },
  cardCallName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "#7b7469",
    marginTop: 4,
  },
  badge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#38506b",
    backgroundColor: "#deebf7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  photoWrap: {
    width: 84,
    height: 84,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#ece7dd",
    flexShrink: 0,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    fontSize: 28,
  },
  infoWrap: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  cardSub: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6a6359",
  },
  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#ece5d8",
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#232323",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6d675e",
  },
});