import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

const catsHeroImage = require("../assets/images/dashboard-cats.png");
const littersHeroImage = require("../assets/images/dashboard-litters.png");

type DashboardPinnedRow = {
  id: string;
  entity_type: "cat" | "litter" | "view" | string;
  entity_id: string;
  position: number;
  parent_cat_id: string | null;
  parent_litter_id: string | null;
};

type CatRow = {
  id: string;
  name: string | null;
  status: string | null;
  is_external: boolean | null;
};

type LitterRow = {
  id: string;
  birth_date: string | null;
  litter_letter: string | null;
  litter_year: number | null;
  mother_id: string | null;
};

type DashboardPinnedUi = {
  id: string;
  entityType: "cat" | "litter" | "view" | string;
  entityId: string;
  title: string;
  subtitle: string;
};

export default function DashboardScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [breedingCatsCount, setBreedingCatsCount] = useState(0);
  const [recentLittersCount, setRecentLittersCount] = useState(0);
  const [pinned, setPinned] = useState<DashboardPinnedUi[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const recentThreshold = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    return d.toISOString().slice(0, 10);
  }, []);

  const formatDate = (value: string | null) => {
    if (!value) return "bez daty";
    const [y, m, d] = value.split("-");
    if (!y || !m || !d) return value;
    return `${d}.${m}.${y}`;
  };

  const buildLitterTitle = (litter: LitterRow) => {
    if (litter.litter_letter && litter.litter_year) {
      return `Miot ${String(litter.litter_letter).toUpperCase()}`;
    }
    if (litter.birth_date) {
      return `Miot z ${formatDate(litter.birth_date)}`;
    }
    return "Miot";
  };

  const loadDashboard = useCallback(async () => {
    setErrorText(null);

    try {
      const [catsResponse, littersResponse, pinnedResponse] = await Promise.all([
        supabase
          .from("cats")
          .select("id, name, status, is_external")
          .eq("status", "breeding")
          .eq("is_external", false),

        supabase
          .from("litters")
          .select("id, birth_date, litter_letter, litter_year, mother_id")
          .gte("birth_date", recentThreshold)
          .order("birth_date", { ascending: false }),

        supabase
          .from("dashboard_items")
          .select("id, entity_type, entity_id, position, parent_cat_id, parent_litter_id")
          .order("position", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(10),
      ]);

      if (catsResponse.error) throw catsResponse.error;
      if (littersResponse.error) throw littersResponse.error;
      if (pinnedResponse.error) throw pinnedResponse.error;

      const breedingCats = (catsResponse.data ?? []) as CatRow[];
      const recentLitters = (littersResponse.data ?? []) as LitterRow[];
      const pinnedRows = (pinnedResponse.data ?? []) as DashboardPinnedRow[];

      setBreedingCatsCount(breedingCats.length);
      setRecentLittersCount(recentLitters.length);

      if (pinnedRows.length === 0) {
        setPinned([]);
        return;
      }

      const catIds = pinnedRows.filter((x) => x.entity_type === "cat").map((x) => x.entity_id);
      const litterIds = pinnedRows.filter((x) => x.entity_type === "litter").map((x) => x.entity_id);

      const [pinnedCatsResponse, pinnedLittersResponse] = await Promise.all([
        catIds.length
          ? supabase.from("cats").select("id, name, status").in("id", catIds)
          : Promise.resolve({ data: [], error: null }),

        litterIds.length
          ? supabase.from("litters").select("id, birth_date, litter_letter, litter_year").in("id", litterIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (pinnedCatsResponse.error) throw pinnedCatsResponse.error;
      if (pinnedLittersResponse.error) throw pinnedLittersResponse.error;

      const catsMap = new Map(
        ((pinnedCatsResponse.data ?? []) as Array<{ id: string; name: string | null; status: string | null }>).map(
          (x) => [x.id, x]
        )
      );

      const littersMap = new Map(
        ((pinnedLittersResponse.data ?? []) as LitterRow[]).map((x) => [x.id, x])
      );

      const pinnedUi: DashboardPinnedUi[] = pinnedRows.map((row) => {
        if (row.entity_type === "cat") {
          const cat = catsMap.get(row.entity_id);
          return {
            id: row.id,
            entityType: row.entity_type,
            entityId: row.entity_id,
            title: cat?.name || "Kot",
            subtitle: cat?.status === "breeding" ? "kot hodowlany" : "kot",
          };
        }

        if (row.entity_type === "litter") {
          const litter = littersMap.get(row.entity_id);
          return {
            id: row.id,
            entityType: row.entity_type,
            entityId: row.entity_id,
            title: litter ? buildLitterTitle(litter) : "Miot",
            subtitle: litter?.birth_date ? formatDate(litter.birth_date) : "szczegóły miotu",
          };
        }

        return {
          id: row.id,
          entityType: row.entity_type,
          entityId: row.entity_id,
          title: "Skrót",
          subtitle: "widok specjalny",
        };
      });

      setPinned(pinnedUi);
    } catch (error: any) {
      console.error("Dashboard load error:", error);
      setErrorText("Nie udało się wczytać pulpitu.");
    }
  }, [recentThreshold]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    await loadDashboard();
    setLoading(false);
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadInitial();
    }, [loadInitial])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }, [loadDashboard]);

  const openPinned = (item: DashboardPinnedUi) => {
    if (item.entityType === "cat") {
      router.push(`/cat/${item.entityId}`);
      return;
    }

    if (item.entityType === "litter") {
      router.push(`/litter/${item.entityId}`);
      return;
    }

    Alert.alert("Ten skrót nie ma jeszcze przypisanego widoku.");
  };

  const removePinned = (item: DashboardPinnedUi) => {
    Alert.alert(
      "Usuń przypięcie",
      `Usunąć "${item.title}" z pulpitu?`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Usuń",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("dashboard_items")
              .delete()
              .eq("id", item.id);

            if (error) {
              Alert.alert("Błąd", "Nie udało się usunąć przypięcia.");
              return;
            }

            await loadDashboard();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Ładowanie pulpitu…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>BAJKOWA KRAINA*PL</Text>
      </View>

      {errorText ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : null}

      <View style={styles.heroGrid}>
        <Pressable
          style={[styles.heroTile, styles.heroCats]}
          onPress={() => router.push("/cats-hub")}
        >
          <Image source={catsHeroImage} style={styles.heroImage} resizeMode="contain" />
          <Text style={styles.heroTitle}>KOTY</Text>
          <Text style={styles.heroSub}>Wszystkie koty</Text>
        </Pressable>

        <Pressable
          style={[styles.heroTile, styles.heroLitters]}
          onPress={() => router.push("/litters-hub")}
        >
          <Image source={littersHeroImage} style={styles.heroImage} resizeMode="contain" />
          <Text style={styles.heroTitle}>MIOTY</Text>
          <Text style={styles.heroSub}>Wszystkie mioty</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>PRZYPIĘTE</Text>
        <Text style={styles.sectionMeta}>{pinned.length}/10</Text>
      </View>

      {pinned.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Na razie tu jest czysto</Text>
          <Text style={styles.emptyText}>
            Gdy przypniesz kota albo miot, pojawi się tutaj jako szybki skrót.
          </Text>
        </View>
      ) : (
        <View style={styles.pinnedGrid}>
          {pinned.map((item) => (
            <Pressable
              key={item.id}
              style={styles.pinnedTile}
              onPress={() => openPinned(item)}
              onLongPress={() => removePinned(item)}
              delayLongPress={450}
            >
              <Text style={styles.pinnedTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.pinnedSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>AKTUALNOŚCI</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardText}>Brak nowych powiadomień</Text>
      </View>

      <View style={styles.calendarHeader}>
        <Text style={styles.calendarDate}>10 maja 2024</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={[styles.actionTile, styles.actionBlue]}>
          <Text style={styles.actionTitle}>Planowane Krycia</Text>
        </Pressable>

        <Pressable style={[styles.actionTile, styles.actionOrange]}>
          <Text style={styles.actionTitle}>Gotowe do Odbioru</Text>
        </Pressable>
      </View>

      <View style={styles.bottomGrid}>
        <View style={[styles.bottomTile, styles.bottomGreen]}>
          <Text style={styles.bottomTitle}>ZDROWIE</Text>
          <Text style={styles.bottomSub}>Kontrola zdrowia</Text>
        </View>

        <View style={[styles.bottomTile, styles.bottomPurple]}>
          <Text style={styles.bottomTitle}>DOKUMENTY</Text>
          <Text style={styles.bottomSub}>Archiwum dokumentów</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f2efea",
  },
  content: {
    paddingBottom: 32,
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: "#f2efea",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#5b5b5b",
  },
  topBar: {
    backgroundColor: "#3d6598",
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  topBarTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  errorBox: {
    backgroundColor: "#fff1f1",
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f2cccc",
  },
  errorText: {
    color: "#8b2d2d",
    fontSize: 14,
  },
  heroGrid: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  heroTile: {
    flex: 1,
    borderRadius: 28,
    padding: 16,
    minHeight: 210,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroCats: {
    backgroundColor: "#79a9dc",
  },
  heroLitters: {
    backgroundColor: "#ee9d4d",
  },
  heroImage: {
    width: "100%",
    height: 92,
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6,
  },
  heroSub: {
    color: "#f8f8f8",
    fontSize: 14,
    marginTop: 4,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#232323",
  },
  sectionMeta: {
    fontSize: 13,
    color: "#817a70",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e6dfd2",
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
  pinnedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  pinnedTile: {
    width: "48.5%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    minHeight: 88,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e6dfd2",
  },
  pinnedTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  pinnedSubtitle: {
    fontSize: 13,
    color: "#726b61",
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e6dfd2",
  },
  infoCardText: {
    fontSize: 15,
    color: "#6d675e",
  },
  calendarHeader: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#e6dfd2",
  },
  calendarDate: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4a4a4a",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 20,
    padding: 14,
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#e6dfd2",
    marginBottom: 20,
  },
  actionTile: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  actionBlue: {
    backgroundColor: "#3f6faa",
  },
  actionOrange: {
    backgroundColor: "#ee8d35",
  },
  actionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  bottomGrid: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
  },
  bottomTile: {
    flex: 1,
    borderRadius: 22,
    minHeight: 130,
    padding: 18,
    justifyContent: "flex-end",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  bottomGreen: {
    backgroundColor: "#4fa166",
  },
  bottomPurple: {
    backgroundColor: "#8a6ec2",
  },
  bottomTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  bottomSub: {
    color: "#f5f5f5",
    fontSize: 14,
  },
});
