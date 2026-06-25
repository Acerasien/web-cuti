import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

interface LeaveSegment {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
}

interface LeaveData {
  id: string;
  reason: string;
  createdAt: string;
  status: string;
  user: {
    name: string;
    nik: string | null;
    position: string | null;
    department: string | null;
    level: string | null;
    lokasiKerja: string | null;
    namaAtasan: string | null;
    atasan: {
      position: string | null;
    } | null;
    subCompany: {
      name: string;
      code: string | null;
    } | null;
  };
  segments: LeaveSegment[];
}

interface LeavePdfTemplateProps {
  leave: LeaveData;
  diketahuiName: string;
  diketahuiPosition: string;
  disetujuiName: string;
  disetujuiPosition: string;
  diterimaName: string;
  diterimaPosition: string;
  exportDate: string;
}

function getLeaveTypeLabel(type: string): string {
  const map: Record<string, string> = {
    PERNIKAHAN_KARYAWAN: "Pernikahan Karyawan",
    PERNIKAHAN_ANAK: "Pernikahan Anak",
    KHITAN_BAPTIS: "Khitan/Baptis Anak",
    ISTRI_MELAHIRKAN: "Istri Melahirkan",
    KEMATIAN_KELUARGA: "Cuti Duka Cita",
    KARYAWATI_MELAHIRKAN: "Melahirkan (Karyawati)",
    KARYAWATI_KEGUGURAN: "Keguguran (Karyawati)",
    SAKIT: "Sakit (Surat Dokter)",
    CUTI_TAHUNAN: "Cuti Tahunan",
    IZIN_LAINNYA: "Izin Lainnya",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

function formatDate(dateInput: string | Date | null): string {
  if (!dateInput) return "—";
  return new Date(dateInput).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#000000",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  logoImage: {
    height: 40,
    width: "auto",
  },
  titleText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    textAlign: "right",
    maxWidth: "60%",
    lineHeight: 1.3,
  },
  headerDivider: {
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
    marginBottom: 15,
  },
  sectionHeader: {
    backgroundColor: "#e2e8f0",
    padding: 5,
    borderWidth: 1.5,
    borderColor: "#000000",
    borderBottomWidth: 0,
    marginTop: 10,
  },
  sectionHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
  },
  detailsContainer: {
    borderWidth: 1.5,
    borderColor: "#000000",
    flexDirection: "row",
    marginBottom: 15,
  },
  detailsColumn: {
    width: "50%",
    flexDirection: "column",
  },
  detailsColumnLeft: {
    width: "50%",
    flexDirection: "column",
    borderRightWidth: 1.5,
    borderRightColor: "#000000",
  },
  detailsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    padding: 5,
    alignItems: "center",
  },
  detailsRowLast: {
    flexDirection: "row",
    padding: 5,
    alignItems: "center",
  },
  detailsLabel: {
    width: "38%",
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
  },
  detailsColon: {
    width: "4%",
    fontSize: 8.5,
    color: "#334155",
  },
  detailsValue: {
    width: "58%",
    fontSize: 8.5,
    color: "#000000",
  },
  segmentsTable: {
    borderWidth: 1.5,
    borderColor: "#000000",
    flexDirection: "column",
    marginBottom: 15,
  },
  segmentsHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    padding: 5,
  },
  segmentsHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
  },
  segmentsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    padding: 5,
  },
  segmentsRowLast: {
    flexDirection: "row",
    padding: 5,
  },
  segmentsCellType: {
    width: "40%",
    fontSize: 8.5,
  },
  segmentsCellDates: {
    width: "45%",
    fontSize: 8.5,
  },
  segmentsCellDays: {
    width: "15%",
    fontSize: 8.5,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  totalRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderTopWidth: 1.5,
    borderTopColor: "#000000",
    padding: 6,
  },
  totalLabel: {
    width: "85%",
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    textAlign: "right",
  },
  totalValue: {
    width: "15%",
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    textAlign: "right",
  },
  reasonContainer: {
    borderWidth: 1.5,
    borderColor: "#000000",
    padding: 8,
    minHeight: 50,
    marginBottom: 20,
  },
  reasonTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: "#334155",
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 8.5,
    color: "#000000",
    lineHeight: 1.3,
  },
  signaturesContainer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sigBox: {
    width: "23.5%",
    borderWidth: 1.5,
    borderColor: "#000000",
    flexDirection: "column",
  },
  sigLabelCell: {
    padding: 5,
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  sigLabelText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    textAlign: "center",
  },
  sigSpaceCell: {
    height: 55,
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
  },
  sigNameCell: {
    padding: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 22,
  },
  sigNameText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textAlign: "center",
  },
  sigPositionCell: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 18,
  },
  sigPositionText: {
    fontSize: 7.5,
    textAlign: "center",
  },
});

export function LeavePdfTemplate({
  leave,
  diketahuiName,
  diketahuiPosition,
  disetujuiName,
  disetujuiPosition,
  diterimaName,
  diterimaPosition,
  exportDate,
}: LeavePdfTemplateProps) {
  const totalDays = leave.segments.reduce(
    (sum, s) => sum + Number(s.totalDays || 0),
    0
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Image
            src={
              leave.user.subCompany?.code
                ? `/logos/${leave.user.subCompany.code}.png`
                : "/logo-h.png"
            }
            style={styles.logoImage}
          />
          <Text style={styles.titleText}>
            FORMULIR CUTI / IJIN TIDAK MASUK KERJA
          </Text>
        </View>
        <View style={styles.headerDivider} />

        {/* Data Karyawan Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>DATA KARYAWAN</Text>
        </View>

        {/* Data Karyawan Grid */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailsColumnLeft}>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Nama Lengkap</Text>
              <Text style={styles.detailsColon}>:</Text>
              <Text style={styles.detailsValue}>{leave.user.name}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>NIK</Text>
              <Text style={styles.detailsColon}>:</Text>
              <Text style={styles.detailsValue}>{leave.user.nik || "—"}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Jabatan</Text>
              <Text style={styles.detailsColon}>:</Text>
              <Text style={styles.detailsValue}>
                {leave.user.position || "—"}
              </Text>
            </View>
            <View style={styles.detailsRowLast}>
              <Text style={styles.detailsLabel}>Departemen</Text>
              <Text style={styles.detailsColon}>:</Text>
              <Text style={styles.detailsValue}>
                {leave.user.department || "—"}
              </Text>
            </View>
          </View>

          <View style={styles.detailsColumn}>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Level Karyawan</Text>
              <Text style={styles.detailsColon}>:</Text>
              <Text style={styles.detailsValue}>{leave.user.level || "—"}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Lokasi Kerja</Text>
              <Text style={styles.detailsColon}>:</Text>
              <Text style={styles.detailsValue}>
                {leave.user.lokasiKerja || "—"}
              </Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Unit Bisnis</Text>
              <Text style={styles.detailsColon}>:</Text>
              <Text style={styles.detailsValue}>
                {leave.user.subCompany?.name || "—"}
              </Text>
            </View>
            <View style={styles.detailsRowLast}>
              <Text style={styles.detailsLabel}>Atasan Langsung</Text>
              <Text style={styles.detailsColon}>:</Text>
              <Text style={styles.detailsValue}>
                {leave.user.namaAtasan || "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Detail Cuti/Izin Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>DETAIL PENGAJUAN CUTI / IZIN</Text>
        </View>

        {/* Segments Table */}
        <View style={styles.segmentsTable}>
          <View style={styles.segmentsHeader}>
            <Text style={[styles.segmentsCellType, styles.segmentsHeaderCell]}>
              Jenis Cuti / Izin
            </Text>
            <Text style={[styles.segmentsCellDates, styles.segmentsHeaderCell]}>
              Tanggal Pelaksanaan
            </Text>
            <Text style={[styles.segmentsCellDays, styles.segmentsHeaderCell]}>
              Durasi
            </Text>
          </View>

          {leave.segments.map((seg, idx) => {
            const isLast = idx === leave.segments.length - 1;
            return (
              <View
                key={seg.id}
                style={isLast ? styles.segmentsRowLast : styles.segmentsRow}
              >
                <Text style={styles.segmentsCellType}>
                  {getLeaveTypeLabel(seg.leaveType)}
                </Text>
                <Text style={styles.segmentsCellDates}>
                  {formatDate(seg.startDate)} s/d {formatDate(seg.endDate)}
                </Text>
                <Text style={styles.segmentsCellDays}>
                  {Number(seg.totalDays)} Hari
                </Text>
              </View>
            );
          })}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Durasi Cuti/Izin :</Text>
            <Text style={styles.totalValue}>{totalDays} Hari Kerja</Text>
          </View>
        </View>

        {/* Reason Box */}
        <View style={styles.reasonContainer}>
          <Text style={styles.reasonTitle}>Alasan / Keterangan Penjelasan:</Text>
          <Text style={styles.reasonText}>{leave.reason || "—"}</Text>
        </View>

        {/* Signatures Grid */}
        <View style={styles.signaturesContainer}>
          {/* Diajukan Oleh */}
          <View style={styles.sigBox}>
            <View style={styles.sigLabelCell}>
              <Text style={styles.sigLabelText}>Diajukan Oleh</Text>
            </View>
            <View style={styles.sigSpaceCell} />
            <View style={styles.sigNameCell}>
              <Text style={styles.sigNameText}>{leave.user.name}</Text>
            </View>
            <View style={styles.sigPositionCell}>
              <Text style={styles.sigPositionText}>{leave.user.position || "—"}</Text>
            </View>
          </View>

          {/* Diketahui Oleh */}
          <View style={styles.sigBox}>
            <View style={styles.sigLabelCell}>
              <Text style={styles.sigLabelText}>Diketahui Oleh</Text>
            </View>
            <View style={styles.sigSpaceCell} />
            <View style={styles.sigNameCell}>
              <Text style={styles.sigNameText}>
                {diketahuiName}
              </Text>
            </View>
            <View style={styles.sigPositionCell}>
              <Text style={styles.sigPositionText}>
                {diketahuiPosition}
              </Text>
            </View>
          </View>

          {/* Disetujui Oleh */}
          <View style={styles.sigBox}>
            <View style={styles.sigLabelCell}>
              <Text style={styles.sigLabelText}>Disetujui Oleh</Text>
            </View>
            <View style={styles.sigSpaceCell} />
            <View style={styles.sigNameCell}>
              <Text style={styles.sigNameText}>{disetujuiName}</Text>
            </View>
            <View style={styles.sigPositionCell}>
              <Text style={styles.sigPositionText}>{disetujuiPosition}</Text>
            </View>
          </View>

          {/* Diterima Oleh */}
          <View style={styles.sigBox}>
            <View style={styles.sigLabelCell}>
              <Text style={styles.sigLabelText}>Diterima Oleh</Text>
            </View>
            <View style={styles.sigSpaceCell} />
            <View style={styles.sigNameCell}>
              <Text style={styles.sigNameText}>{diterimaName}</Text>
            </View>
            <View style={styles.sigPositionCell}>
              <Text style={styles.sigPositionText}>{diterimaPosition}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
