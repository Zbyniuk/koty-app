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

      const catIds = pinnedRows
        .filter((x) => x.entity_type === "cat")
        .map((x) => x.entity_id);

      const litterIds = pinnedRows
        .filter((x) => x.entity_type === "litter")
        .map((x) => x.entity_id);

      const [pinnedCatsResponse, pinnedLittersResponse] = await Promise.all([
        catIds.length
          ? supabase.from("cats").select("id, name, status").in("id", catIds)
          : Promise.resolve({ data: [], error: null }),

        litterIds.length
          ? supabase
              .from("litters")
              .select("id, birth_date, litter_letter, litter_year")
              .in("id", litterIds)
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
      <View style={styles.headerBlock}>
        <Text style={styles.headerTitle}>Bajkowa Kraina*PL</Text>
        <Text style={styles.headerSubtitle}>System hodowli kotów</Text>
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
          <Image source={catsHeroImage} style={styles.heroImageTop} resizeMode="contain" />
          <View>
            <Text style={styles.heroLabel}>KOTY</Text>
            <Text style={styles.heroValue}>{breedingCatsCount}</Text>
            <Text style={styles.heroHint}>kotów hodowlanych</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.heroTile, styles.heroLitters]}
          onPress={() => router.push("/litters-hub")}
        >
          <Image source={littersHeroImage} style={styles.heroImageTop} resizeMode="contain" />
          <View>
            <Text style={styles.heroLabel}>MIOTY</Text>
            <Text style={styles.heroValue}>{recentLittersCount}</Text>
            <Text style={styles.heroHint}>z ostatnich 12 miesięcy</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>SZYBKIE WEJŚCIA</Text>
      </View>

      <View style={styles.quickGrid}>
        <Pressable style={styles.quickTile} onPress={() => router.push("/cats-hub")}>
          <Text style={styles.quickTitle}>PLANOWANE KRYCIA</Text>
          <Text style={styles.quickSubtitle}>moduł do rozbudowy</Text>
        </Pressable>

        <Pressable style={styles.quickTile} onPress={() => router.push("/litters-hub")}>
          <Text style={styles.quickTitle}>GOTOWE DO ODBIORU</Text>
          <Text style={styles.quickSubtitle}>najnowsze mioty</Text>
        </Pressable>

        <View style={styles.quickTile}>
          <Text style={styles.quickTitle}>ZDROWIE</Text>
          <Text style={styles.quickSubtitle}>moduł do rozbudowy</Text>
        </View>

        <View style={styles.quickTile}>
          <Text style={styles.quickTitle}>DOKUMENTY</Text>
          <Text style={styles.quickSubtitle}>moduł do rozbudowy</Text>
        </View>
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
        <Text style={styles.infoCardTitle}>Brak nowych zdarzeń</Text>
        <Text style={styles.infoCardText}>
          W tej sekcji pokażemy później alerty, nowości i najważniejsze sprawy z hodowli.
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>KALENDARZ</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Kalendarz hodowli</Text>
        <Text style={styles.infoCardText}>
          Tu będzie kalendarz kryć, porodów, szczepień i odbiorów.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7f4ee",
  },
  content: {
    padding: 20,
    paddingBottom: 32,
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
  headerBlock: {
    marginBottom: 22,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#242424",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 15,
    color: "#7c756a",
  },
  errorBox: {
    backgroundColor: "#fff1f1",
    borderRadius: 18,
    padding: 14,
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
    marginBottom: 24,
  },
  heroTile: {
    flex: 1,
    minHeight: 210,
    borderRadius: 28,
    padding: 16,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  heroCats: {
    backgroundColor: "#7eb1e6",
  },
  heroLitters: {
    backgroundColor: "#f2a252",
  },
  heroImageTop: {
    width: "100%",
    height: 92,
    marginBottom: 10,
  },
  heroLabel: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#ffffff",
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 40,
    fontWeight: "900",
    color: "#ffffff",
    lineHeight: 44,
  },
  heroHint: {
    fontSize: 14,
    color: "#f8f8f8",
    marginTop: 3,
  },
  sectionHeader: {
    marginTop: 2,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1f1f1f",
  },
  sectionMeta: {
    fontSize: 13,
    color: "#817a70",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 22,
  },
  quickTile: {
    width: "48.5%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    minHeight: 88,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ece5d8",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  quickTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#222222",
  },
  quickSubtitle: {
    fontSize: 13,
    color: "#6f685d",
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ece5d8",
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
    marginBottom: 20,
  },
  pinnedTile: {
    width: "48.5%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    minHeight: 96,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ece5d8",
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
    borderRadius: 22,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ece5d8",
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#232323",
    marginBottom: 6,
  },
  infoCardText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6d675e",
  },
});
