import React, { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";

type CatRow = {
  id: string;
  name: string | null;
  call_name?: string | null;
  cattery_name?: string | null;
  title_prefix?: string | null;
  title_suffix?: string | null;
  sex?: string | null;
  status?: string | null;
};

type KittenRow = {
  id: string;
  litter_id: string | null;
  name: string | null;
  call_name?: string | null;
};

type LitterRow = {
  id: string;
  birth_date: string | null;
  mother_id: string | null;
  father_id: string | null;
  mother?: CatRow | null;
  father?: CatRow | null;
};

function fullCatName(cat?: CatRow | null) {
  if (!cat) return "—";

  const parts = [
    cat.title_prefix || "",
    cat.call_name || "",
    cat.cattery_name || "",
    cat.title_suffix || "",
  ]
    .map((x) => (x || "").trim())
    .filter(Boolean);

  if (parts.length) return parts.join(" ");
  return cat.name || "—";
}

function getKittenDisplayName(kitten?: KittenRow | null) {
  if (!kitten) return "";
  return (kitten.call_name || kitten.name || "").trim();
}

function getLitterLetter(kittens: KittenRow[]) {
  const firstKitten = kittens.find((k) => getKittenDisplayName(k));
  if (!firstKitten) return "";
  const firstName = getKittenDisplayName(firstKitten);
  return firstName.charAt(0).toUpperCase();
}

function kittensLabel(count: number) {
  if (count === 1) return "1 kocię";
  if (count >= 2 && count <= 4) return `${count} kocięta`;
  return `${count} kociąt`;
}

export default function LitterListScreen() {
  const { id } = useLocalSearchParams();
  const [cat, setCat] = useState<CatRow | null>(null);
  const [litters, setLitters] = useState<LitterRow[]>([]);
  const [kittensByLitter, setKittensByLitter] = useState<Record<string, KittenRow[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: catData } = await supabase
      .from("cats")
      .select("*")
      .eq("id", id)
      .single();

    const isMale = catData?.sex === "M";

    const query = supabase
      .from("litters")
      .select(`
        id,
        birth_date,
        mother_id,
        father_id,
        mother:mother_id(id, name, call_name, cattery_name, title_prefix, title_suffix, sex),
        father:father_id(id, name, call_name, cattery_name, title_prefix, title_suffix, sex)
      `)
      .order("birth_date", { ascending: false });

    const { data: littersData } = isMale
      ? await query.eq("father_id", id)
      : await query.eq("mother_id", id);

    const litterRows = (littersData as LitterRow[]) || [];
    const litterIds = litterRows.map((l) => l.id);

    let kittensMap: Record<string, KittenRow[]> = {};

    if (litterIds.length > 0) {
      const { data: kittensData } = await supabase
        .from("cats")
        .select("id, litter_id, name, call_name")
        .in("litter_id", litterIds);

      const kittens = (kittensData as KittenRow[]) || [];

      kittensMap = kittens.reduce((acc, kitten) => {
        const litterId = kitten.litter_id;
        if (!litterId) return acc;
        if (!acc[litterId]) acc[litterId] = [];
        acc[litterId].push(kitten);
        return acc;
      }, {} as Record<string, KittenRow[]>);
    }

    setCat(catData || null);
    setLitters(litterRows);
    setKittensByLitter(kittensMap);
    setLoading(false);
  };

  const isMale = cat?.sex === "M";
  const headerLabel = isMale ? "KRYCIA" : "MIOTY";

  const totalKittens = useMemo(
    () => Object.values(kittensByLitter).reduce((sum, arr) => sum + arr.length, 0),
    [kittensByLitter]
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.heroCard}>
        <Image
          source={require("../assets/images/MIOTY.png")}
          style={styles.heroImage}
        />
        <Text style={styles.header}>{headerLabel}</Text>
        <Text style={styles.totalText}>Łącznie kociąt: {totalKittens}</Text>
      </View>

      {loading ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Ładowanie...</Text>
        </View>
      ) : litters.length === 0 ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {isMale ? "Brak kryć" : "Brak miotów"}
          </Text>
        </View>
      ) : (
        litters.map((litter) => {
          const counterpartName = isMale
            ? fullCatName(litter.mother)
            : fullCatName(litter.father);

          const kittens = kittensByLitter[litter.id] || [];
          const litterLetter = getLitterLetter(kittens);
          const litterTitle = litterLetter ? `Miot ${litterLetter}` : "Miot";
          const countText = kittensLabel(kittens.length);

          return (
            <TouchableOpacity
              key={litter.id}
              style={styles.card}
              onPress={() => router.push(`/litter/${litter.id}`)}
            >
              <Text style={styles.cardTitle}>
                {litterTitle} - {countText}
              </Text>
              <Text
                style={styles.counterpartLine}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {counterpartName}
              </Text>
              <Text style={styles.dateLine}>{litter.birth_date || "—"}</Text>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4efe9",
    padding: 16,
  },
  heroCard: {
    backgroundColor: "#fff7ef",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 18,
    alignItems: "center",
  },
  heroImage: {
    width: 110,
    height: 110,
    marginBottom: 10,
    resizeMode: "contain",
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2d3142",
    marginBottom: 6,
  },
  totalText: {
    fontSize: 17,
    color: "#6b705c",
    fontWeight: "600",
  },
  infoBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
  },
  infoText: {
    fontSize: 16,
    color: "#666",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 8,
  },
  counterpartLine: {
    fontSize: 15,
    color: "#444",
    marginBottom: 10,
  },
  dateLine: {
    fontSize: 14,
    color: "#7a7a7a",
    fontWeight: "600",
  },
});
