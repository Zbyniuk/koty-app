import { useEffect, useMemo, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { supabase } from "../../../lib/supabase";

type LitterRow = {
  id: string;
  litter_letter: string | null;
  litter_year: number | null;
  birth_date: string | null;
};

type CatRow = {
  id: string;
  name: string | null;
  sex: string | null;
  birth_date: string | null;
  litter_id: string | null;
  kitten_number: number | null;
  temporary_label: string | null;
};

type SessionColumn = {
  key: string;
  date: string;
  time: string;
};

type Marker = {
  key: string;
  label: string;
  color: string;
};

const LEFT_COL_WIDTH = 118;
const TILE_WIDTH = 86;

export default function LitterWeightsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [status, setStatus] = useState("Ładowanie...");
  const [litter, setLitter] = useState<LitterRow | null>(null);
  const [kittens, setKittens] = useState<CatRow[]>([]);
  const [selectedTile, setSelectedTile] = useState<string | null>(null);

  function getLitterDisplayName(l: LitterRow | null) {
    if (!l) return String(id).toUpperCase();
    if (l.litter_letter && l.litter_year) return `${l.litter_letter}-${l.litter_year}`;
    if (l.litter_letter) return `Miot ${l.litter_letter}`;
    return String(id).toUpperCase();
  }

  useEffect(() => {
    async function loadData() {
      setStatus("Ładowanie...");

      const { data: littersData, error: littersError } = await supabase
        .from("litters")
        .select("id, litter_letter, litter_year, birth_date")
        .order("birth_date", { ascending: false })
        .limit(1);

      if (littersError) {
        setStatus("Błąd odczytu miotu");
        console.log("LITTER ERROR:", littersError);
        return;
      }

      const firstLitter = littersData?.[0];

      if (!firstLitter) {
        setStatus("Brak miotów w bazie");
        return;
      }

      setLitter(firstLitter);

      const { data: catsData, error: catsError } = await supabase
        .from("cats")
        .select("id, name, sex, birth_date, litter_id, kitten_number, temporary_label")
        .eq("litter_id", firstLitter.id)
        .order("kitten_number", { ascending: true });

      if (catsError) {
        setStatus("Błąd odczytu kociąt");
        console.log("CATS ERROR:", catsError);
        return;
      }

      setKittens(catsData ?? []);
      setStatus("Dane miotu załadowane");
    }

    loadData();
  }, []);

  const sessionColumns: SessionColumn[] = useMemo(
    () => [
      { key: "s1", date: "05.05.2026", time: "08:00" },
    { key: "s2", date: "05.05.2026", time: "20:00" },
    { key: "s3", date: "06.05.2026", time: "08:00" },
    { key: "s4", date: "06.05.2026", time: "20:00" },
    { key: "s5", date: "07.05.2026", time: "08:00" },
    { key: "s6", date: "07.05.2026", time: "20:00" },
    ],
    []
  );

  function getMockWeight(catIndex: number, dayIndex: number) {
    const base = 82 + catIndex * 11;
    let weight = base + dayIndex * (9 + catIndex);

    if (catIndex === 1 && dayIndex === 3) weight -= 20;
    if (catIndex === 2 && dayIndex === 4) weight -= 12;
    if (catIndex === 0 && dayIndex === 1) weight -= 8;

    return weight;
  }

  function getDelta(current: number, previous: number | null) {
    if (previous === null) return null;
    return current - previous;
  }

  function getTileColor(delta: number | null) {
    if (delta === null) return "#f6efe7";
    if (delta < 0) return "#fdeaea";
    if (delta === 0) return "#f3f0eb";
    return "#edf7ee";
  }

  function getDeltaColor(delta: number | null) {
    if (delta === null) return "#8a817c";
    if (delta < 0) return "#bc4749";
    if (delta === 0) return "#8a817c";
    return "#6a994e";
  }

  function getMarkers(catIndex: number, dayIndex: number): Marker[] {
    const redMarker: Marker = {
      key: "red",
      label: "Shotapen",
      color: "#e76f51",
    };

    const blueMarker: Marker = {
      key: "blue",
      label: "Płyn Ringera",
      color: "#4dabf7",
    };

    const greenMarker: Marker = {
      key: "green",
      label: "Glukoza",
      color: "#69db7c",
    };

    const yellowMarker: Marker = {
      key: "yellow",
      label: "Dokarmianie",
      color: "#f4d35e",
    };

    const patterns: Marker[][] = [
      [],
      [greenMarker],
      [redMarker],
      [blueMarker],
      [yellowMarker],
      [redMarker, greenMarker],
      [blueMarker, greenMarker],
      [redMarker, blueMarker],
      [redMarker, yellowMarker],
      [greenMarker, yellowMarker],
      [redMarker, blueMarker, greenMarker],
      [redMarker, blueMarker, yellowMarker],
      [redMarker, greenMarker, yellowMarker],
      [blueMarker, greenMarker, yellowMarker],
      [redMarker, blueMarker, greenMarker, yellowMarker],
    ];

    const patternIndex = (catIndex * 3 + dayIndex) % patterns.length;
    return patterns[patternIndex];
  }

  function buildMarkerDescription(markers: Marker[]) {
    if (markers.length === 0) {
      return "Brak dodatkowych znaczników.";
    }

    return markers.map((marker) => `• ${marker.label}`).join("\n");
  }

  return (
    <>
      <Stack.Screen options={{ title: `Wagi • ${id}` }} />

      <ScrollView style={{ flex: 1, backgroundColor: "#faf7f2" }}>
        <View style={{ paddingHorizontal: 8, paddingTop: 10, paddingBottom: 24 }}>
          <View
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 20,
              padding: 16,
              marginBottom: 14,
            }}
          >
            <Text style={{ color: "#8a817c", fontSize: 13 }}>MIOT</Text>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "600",
                color: "#3f3a37",
                marginTop: 4,
              }}
            >
              {getLitterDisplayName(litter)}
            </Text>
            <Text style={{ marginTop: 8, color: "#6b5e57" }}>{status}</Text>
            <Text style={{ marginTop: 4, color: "#8a817c" }}>
              Data urodzenia: {litter?.birth_date ?? "—"}
            </Text>
          </View>

          <Text
            style={{
              marginBottom: 8,
              color: "#8a817c",
              fontSize: 13,
              letterSpacing: 0.3,
              paddingHorizontal: 2,
            }}
          >
            SIATKA WAG
          </Text>

          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ width: LEFT_COL_WIDTH }}>
              <View
                style={{
                  height: 62,
                  backgroundColor: "#f3eee8",
                  borderTopLeftRadius: 16,
                  borderRightWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: "#ebe3db",
                  justifyContent: "center",
                  paddingHorizontal: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: "#8a817c",
                    fontWeight: "600",
                  }}
                >
                  KOCIĘ
                </Text>
              </View>

              {kittens.map((kitten) => (
                <View
                  key={kitten.id}
                  style={{
                    minHeight: 96,
                    backgroundColor: "#ffffff",
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                    borderRightWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: "#f0e7df",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#3f3a37",
                    }}
                    numberOfLines={1}
                  >
                    {kitten.name ?? kitten.temporary_label ?? "Bez nazwy"}
                  </Text>

                  <Text style={{ marginTop: 5, fontSize: 12, color: "#8a817c" }}>
                    Nr: {kitten.kitten_number ?? "—"}
                  </Text>

                  <Text style={{ marginTop: 2, fontSize: 12, color: "#8a817c" }}>
                    {kitten.sex === "F" ? "Kotka" : kitten.sex === "M" ? "Kocur" : "—"}
                  </Text>
                </View>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={{ flexDirection: "row" }}>
                  {sessionColumns.map((col) => (
                    <View
                      key={col.key}
                      style={{
                        width: TILE_WIDTH,
                        height: 62,
                        backgroundColor: "#f3eee8",
                        borderRightWidth: 1,
                        borderBottomWidth: 1,
                        borderColor: "#ebe3db",
                        justifyContent: "center",
                        alignItems: "center",
                        paddingHorizontal: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: "#6b5e57",
                          fontWeight: "600",
                        }}
                      >
                        {col.date}
                      </Text>
                      <Text
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          color: "#8a817c",
                        }}
                      >
                        {col.time}
                      </Text>
                    </View>
                  ))}

                  <Pressable
                    onPress={() => Alert.alert("Nowy pomiar", "Tu później dodamy nową sesję ważenia.")}
                    style={{
                      width: 52,
                      height: 62,
                      backgroundColor: "#f3eee8",
                      borderRightWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: "#ebe3db",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 28,
                        lineHeight: 28,
                        color: "#6b5e57",
                        fontWeight: "400",
                      }}
                    >
                      +
                    </Text>
                  </Pressable>
                </View>

                {kittens.map((kitten, catIndex) => (
                  <View
                    key={kitten.id}
                    style={{
                      flexDirection: "row",
                    }}
                  >
                    {sessionColumns.map((col, dayIndex) => {
                      const weight = getMockWeight(catIndex, dayIndex);
                      const prevWeight =
                        dayIndex > 0 ? getMockWeight(catIndex, dayIndex - 1) : null;
                      const delta = getDelta(weight, prevWeight);
                      const tileId = `${kitten.id}-${col.key}`;
                      const isSelected = selectedTile === tileId;
                      const markers = getMarkers(catIndex, dayIndex);

                      return (
                        <Pressable
                          key={col.key}
                          onPress={() => {
                            setSelectedTile(tileId);

                            Alert.alert(
                              "Szczegóły kafelka",
                              `${kitten.name ?? kitten.temporary_label ?? "Kocię"} • ${col.date} ${col.time}

Waga: ${weight} g
Zmiana: ${delta === null ? "start" : `${delta > 0 ? "+" : ""}${delta}`}

Znaczniki:
${buildMarkerDescription(markers)}`
                            );
                          }}
                          style={{
                            width: TILE_WIDTH,
                            minHeight: 96,
                            padding: 4,
                            borderRightWidth: 1,
                            borderBottomWidth: 1,
                            borderColor: "#f0e7df",
                            backgroundColor: "#ffffff",
                          }}
                        >
                          <View
                            style={{
                              flex: 1,
                              borderRadius: 14,
                              backgroundColor: isSelected ? "#e7f0ff" : getTileColor(delta),
                              paddingVertical: 10,
                              paddingHorizontal: 6,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 17,
                                fontWeight: "700",
                                color: "#3f3a37",
                              }}
                            >
                              {weight} g
                            </Text>

                            <Text
                              style={{
                                marginTop: 5,
                                fontSize: 12,
                                fontWeight: "600",
                                color: getDeltaColor(delta),
                              }}
                            >
                              {delta === null ? "start" : `${delta > 0 ? "+" : ""}${delta}`}
                            </Text>

                            <View
                              style={{
                                flexDirection: "row",
                                gap: 4,
                                marginTop: 8,
                                minHeight: 16,
                                alignItems: "center",
                                justifyContent: "center",
                                flexWrap: "wrap",
                              }}
                            >
                              {markers.map((marker) => (
                                <View
                                  key={marker.key}
                                  style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: 4,
                                    backgroundColor: marker.color,
                                  }}
                                />
                              ))}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}

                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          "Nowy pomiar",
                          `Tu później dodamy nowy pomiar dla: ${
                            kitten.name ?? kitten.temporary_label ?? "kocię"
                          }`
                        )
                      }
                      style={{
                        width: 52,
                        minHeight: 96,
                        padding: 4,
                        borderRightWidth: 1,
                        borderBottomWidth: 1,
                        borderColor: "#f0e7df",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          borderRadius: 14,
                          backgroundColor: "#f8f3ed",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 26,
                            lineHeight: 26,
                            color: "#8a817c",
                            fontWeight: "300",
                          }}
                        >
                          +
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          <View
            style={{
              marginTop: 14,
              backgroundColor: "#ffffff",
              borderRadius: 18,
              padding: 14,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#3f3a37" }}>
              Podgląd znaczników
            </Text>

            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    backgroundColor: "#e76f51",
                    marginRight: 10,
                  }}
                />
                <Text style={{ color: "#6b5e57" }}>Shotapen</Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    backgroundColor: "#4dabf7",
                    marginRight: 10,
                  }}
                />
                <Text style={{ color: "#6b5e57" }}>Płyn Ringera</Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    backgroundColor: "#69db7c",
                    marginRight: 10,
                  }}
                />
                <Text style={{ color: "#6b5e57" }}>Glukoza</Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    backgroundColor: "#f4d35e",
                    marginRight: 10,
                  }}
                />
                <Text style={{ color: "#6b5e57" }}>Dokarmianie</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}