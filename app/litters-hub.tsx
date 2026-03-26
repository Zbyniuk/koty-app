import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

type LitterRow = {
  id: string;
  birth_date: string | null;
  litter_letter: string | null;
  litter_year: number | null;
  mother_id: string | null;
  father_id: string | null;
};

type CatCountRow = {
  litter_id: string | null;
};

type CatNameRow = {
  id: string;
  name: string | null;
};

export default function LittersHubScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [litters, setLitters] = useState<LitterRow[]>([]);
  const [kittensCountMap, setKittensCountMap] = useState<Record<string, number>>({});
  const [motherNameMap, setMotherNameMap] = useState<Record<string, string>>({});
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

  const buildLitterTitle = (item: LitterRow) => {
    if (item.litter_letter && item.litter_year) {
      return `Miot ${String(item.litter_letter).toUpperCase()}`;
    }
    if (item.birth_date) {
      return `Miot z ${formatDate(item.birth_date)}`;
    }
    return "Miot";
  };

  const loadLitters = useCallback(async () => {
    setErrorText(null);

    try {
      const { data, error } = await supabase
        .from("litters")
        .select("id, birth_date, litter_letter, litter_year, mother_id, father_id")
        .gte("birth_date", recentThreshold)
        .order("birth_date", { ascending: false });

      if (error) throw error;

      const litterRows = (data ?? []) as LitterRow[];
      setLitters(litterRows);

      const litterIds = litterRows.map((x) => x.id);
      const motherIds = litterRows
        .map((x) => x.mother_id)
        .filter(Boolean) as string[];

      const [kittensResponse, mothersResponse] = await Promise.all([
        litterIds.length
          ? supabase.from("cats").select("litter_id").in("litter_id", litterIds)
          : Promise.resolve({ data: [], error: null }),

        motherIds.length
          ? supabase.from("cats").select("id, name").in("id", motherIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (kittensResponse.error) throw kittensResponse.error;
      if (mothersResponse.error) throw mothersResponse.error;

      const counts: Record<string, number> = {};
      ((kittensResponse.data ?? []) as CatCountRow[]).forEach((row) => {
        if (!row.litter_id) return;
        counts[row.litter_id] = (counts[row.litter_id] || 0) + 1;
      });

      const mothersMap: Record<string, string> = {};
      ((mothersResponse.data ?? []) as CatNameRow[]).forEach((row) => {
        mothersMap[row.id] = row.name || "nieznana matka";
      });

      setKittensCountMap(counts);
      setMotherNameMap(mothersMap);
    } catch (error) {
      console.error("Litters hub load error:", error);
      setErrorText("Nie udało się wczytać listy miotów.");
    }
  }, [recentThreshold]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    await loadLitters();
    setLoading(false);
  }, [loadLitters]);

  useFocusEffect(
    useCallback(() => {
      loadInitial();
    }, [loadInitial])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLitters();
    setRefreshing(false);
  }, [loadLitters]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Ładowanie miotów…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MIOTY</Text>
        <Text style={styles.title}>Najnowsze mioty</Text>
        <Text style={styles.subtitle}>
          Bez ściany kafelków — tylko porządek i najważniejsze dane.
        </Text>
      </View>

      {errorText ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : null}

      <FlatList
        data={litters}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/litter/${item.id}`)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{buildLitterTitle(item)}</Text>
              <Text style={styles.badge}>
                {kittensCountMap[item.id] || 0} koc.
              </Text>
            </View>

            <Text style={styles.cardSub}>
              data urodzenia: {formatDate(item.birth_date)}
            </Text>
            <Text style={styles.cardSub}>
              matka: {item.mother_id ? motherNameMap[item.mother_id] || "nieznana" : "nieznana"}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Brak miotów z ostatnich 12 miesięcy</Text>
            <Text style={styles.emptyText}>
              Gdy w bazie będą nowsze mioty, pokażą się tutaj automatycznie.
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
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: "#666056",
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
    gap: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ece5d8",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: "#202020",
  },
  badge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6a4a14",
    backgroundColor: "#ffe9c9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  cardSub: {
    fontSize: 14,
    color: "#6a6359",
    marginTop: 2,
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