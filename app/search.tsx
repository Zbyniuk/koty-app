import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

type CatSearchRow = {
  id: string;
  name: string | null;
  registered_name: string | null;
  call_name: string | null;
  cattery_name: string | null;
  notes: any;
  birth_date?: string | null;
};

type OwnerSearchRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  city: string | null;
  notes: string | null;
};

type LitterSearchRow = {
  id: string;
  birth_date: string | null;
  litter_letter: string | null;
  litter_year: number | null;
  notes: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "bez daty";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function buildLitterTitle(litter: LitterSearchRow) {
  if (litter.litter_letter && litter.litter_year) {
    return `Miot ${String(litter.litter_letter).toUpperCase()}`;
  }
  if (litter.birth_date) {
    return `Miot z ${formatDate(litter.birth_date)}`;
  }
  return "Miot";
}

function stringifyNotes(value: any) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [cats, setCats] = useState<CatSearchRow[]>([]);
  const [owners, setOwners] = useState<OwnerSearchRow[]>([]);
  const [litters, setLitters] = useState<LitterSearchRow[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const trimmed = useMemo(() => query.trim(), [query]);

  const runSearch = async (text: string) => {
    setQuery(text);
    setErrorText(null);

    const q = text.trim();

    if (q.length < 2) {
      setCats([]);
      setOwners([]);
      setLitters([]);
      return;
    }

    setLoading(true);

    try {
      const catsQueries = await Promise.all([
        supabase.from("cats").select("id, name, registered_name, call_name, cattery_name, notes, birth_date").ilike("name", `%${q}%`).limit(20),
        supabase.from("cats").select("id, name, registered_name, call_name, cattery_name, notes, birth_date").ilike("registered_name", `%${q}%`).limit(20),
        supabase.from("cats").select("id, name, registered_name, call_name, cattery_name, notes, birth_date").ilike("call_name", `%${q}%`).limit(20),
        supabase.from("cats").select("id, name, registered_name, call_name, cattery_name, notes, birth_date").ilike("cattery_name", `%${q}%`).limit(20),
        supabase.from("cats").select("id, name, registered_name, call_name, cattery_name, notes, birth_date").filter("notes", "ilike", `%${q}%`).limit(20),
      ]);

      const ownersQueries = await Promise.all([
        supabase.from("owners").select("id, first_name, last_name, email, city, notes").ilike("first_name", `%${q}%`).limit(20),
        supabase.from("owners").select("id, first_name, last_name, email, city, notes").ilike("last_name", `%${q}%`).limit(20),
        supabase.from("owners").select("id, first_name, last_name, email, city, notes").ilike("email", `%${q}%`).limit(20),
        supabase.from("owners").select("id, first_name, last_name, email, city, notes").ilike("city", `%${q}%`).limit(20),
        supabase.from("owners").select("id, first_name, last_name, email, city, notes").ilike("notes", `%${q}%`).limit(20),
      ]);

      const littersResponse = await supabase
        .from("litters")
        .select("id, birth_date, litter_letter, litter_year, notes")
        .ilike("notes", `%${q}%`)
        .limit(20);

      const catErrors = catsQueries.map((x) => x.error).filter(Boolean);
      const ownerErrors = ownersQueries.map((x) => x.error).filter(Boolean);

      if (catErrors.length) throw catErrors[0];
      if (ownerErrors.length) throw ownerErrors[0];
      if (littersResponse.error) throw littersResponse.error;

      const catsMap = new Map<string, CatSearchRow>();
      for (const response of catsQueries) {
        for (const row of (response.data ?? []) as CatSearchRow[]) {
          catsMap.set(row.id, row);
        }
      }

      const ownersMap = new Map<number, OwnerSearchRow>();
      for (const response of ownersQueries) {
        for (const row of (response.data ?? []) as OwnerSearchRow[]) {
          ownersMap.set(row.id, row);
        }
      }

      setCats(Array.from(catsMap.values()));
      setOwners(Array.from(ownersMap.values()));
      setLitters((littersResponse.data ?? []) as LitterSearchRow[]);
    } catch (error) {
      console.error("Search error:", error);
      setErrorText("Nie udało się wykonać wyszukiwania.");
      setCats([]);
      setOwners([]);
      setLitters([]);
    } finally {
      setLoading(false);
    }
  };

  const hasResults = cats.length > 0 || owners.length > 0 || litters.length > 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>WYSZUKIWARKA</Text>
        <Text style={styles.title}>Szukaj w całym systemie</Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={runSearch}
          placeholder="Wpisz np. BAZYL, Kont, miot, lek..."
          placeholderTextColor="#9a9388"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {errorText ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Szukam…</Text>
        </View>
      ) : null}

      {!loading && trimmed.length < 2 ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Globalna wyszukiwarka</Text>
          <Text style={styles.infoText}>
            Już teraz przeszukuje koty właścicieli i notatki miotów. Wraz z rozbudową bazy
            zacznie zwracać także leczenie dokumenty i rezerwacje.
          </Text>
        </View>
      ) : null}

      {!loading && trimmed.length >= 2 && !hasResults ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Brak wyników</Text>
          <Text style={styles.emptyText}>
            Nie znalazłem niczego dla frazy „{trimmed}”.
          </Text>
        </View>
      ) : null}

      {!loading && cats.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KOTY</Text>

          <FlatList
            data={cats}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.listGap}
            renderItem={({ item }) => {
              const subtitle =
                item.registered_name ||
                item.call_name ||
                item.cattery_name ||
                stringifyNotes(item.notes) ||
                "szczegóły kota";

              return (
                <Pressable
                  style={styles.card}
                  onPress={() => router.push(`/cat/${item.id}`)}
                >
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.name || "Kot"}
                  </Text>
                  <Text style={styles.cardSub} numberOfLines={2}>
                    {subtitle}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {item.birth_date ? `ur. ${formatDate(item.birth_date)}` : "przejdź do karty kota"}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      ) : null}

      {!loading && owners.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WŁAŚCICIELE</Text>

          <FlatList
            data={owners}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
            contentContainerStyle={styles.listGap}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {item.first_name} {item.last_name}
                </Text>
                <Text style={styles.cardSub} numberOfLines={2}>
                  {item.email || item.city || item.notes || "dane właściciela"}
                </Text>
                <Text style={styles.cardMeta}>
                  {item.city || "właściciel / kontakt"}
                </Text>
              </View>
            )}
          />
        </View>
      ) : null}

      {!loading && litters.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MIOTY</Text>

          <FlatList
            data={litters}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.listGap}
            renderItem={({ item }) => (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/litter/${item.id}`)}
              >
                <Text style={styles.cardTitle}>
                  {buildLitterTitle(item)}
                </Text>
                <Text style={styles.cardSub} numberOfLines={2}>
                  {item.notes || "notatki miotu"}
                </Text>
                <Text style={styles.cardMeta}>
                  {item.birth_date ? formatDate(item.birth_date) : "miot bez daty"}
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {!loading ? (
        <View style={styles.futureCard}>
          <Text style={styles.futureTitle}>Przygotowane pod dalszą rozbudowę</Text>
          <Text style={styles.futureText}>
            Ten ekran jest gotowy pod przyszłe źródła: leczenie dokumenty rezerwacje i inne moduły.
          </Text>
        </View>
      ) : null}
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
  searchBox: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: "#1f1f1f",
    borderWidth: 1,
    borderColor: "#ece5d8",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 10,
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
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: "#ece5d8",
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#232323",
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6d675e",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 20,
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
  section: {
    marginTop: 18,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#232323",
    marginBottom: 10,
  },
  listGap: {
    gap: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ece5d8",
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: "#202020",
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6a6359",
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 13,
    color: "#8a8377",
  },
  futureCard: {
    backgroundColor: "#f0ebe3",
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#e2dacb",
  },
  futureTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2a2a2a",
    marginBottom: 6,
  },
  futureText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#675f55",
  },
});
