import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle
} from "docx";

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

const noneBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
};

function createDataRow(label: string, value: string, isValueBold: boolean = false) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        borders: noneBorders,
        children: [
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: label,
                font: "Calibri",
                size: 22,
                color: "475569"
              })
            ]
          })
        ]
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        borders: noneBorders,
        children: [
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: `: ${value}`,
                bold: isValueBold,
                font: "Calibri",
                size: 22,
                color: isValueBold ? "0F172A" : "1E293B"
              })
            ]
          })
        ]
      })
    ]
  });
}

function createSectionHeader(title: string) {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "auto" },
          bottom: { style: BorderStyle.SINGLE, size: 12, color: "0F172A" },
          left: { style: BorderStyle.NONE, size: 0, color: "auto" },
          right: { style: BorderStyle.NONE, size: 0, color: "auto" }
        },
        children: [
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: title,
                bold: true,
                font: "Calibri",
                size: 24,
                color: "0F172A"
              })
            ]
          })
        ]
      })
    ]
  });
}

export async function exportLeaveToDocx(leave: any, reviewerName: string) {
  const startDates = leave.segments.map((s: any) => new Date(s.startDate).getTime());
  const earliestStart = startDates.length > 0 ? new Date(Math.min(...startDates)) : new Date(leave.createdAt);
  const totalDays = leave.segments.reduce((sum: number, s: any) => sum + Number(s.totalDays || 0), 0);

  const rows = [
    // Section 1: Data Karyawan
    createSectionHeader("DATA KARYAWAN"),
    createDataRow("Nama Lengkap", leave.user.name, true),
    createDataRow("Jabatan / Posisi", leave.user.position || "—"),
    createDataRow("Departemen", leave.user.department || "—"),
    createDataRow("Email", leave.user.email || "—"),

    // Section 2: Detail Pengajuan
    createSectionHeader("DETAIL PENGAJUAN GABUNGAN"),
    ...leave.segments.flatMap((seg: any, idx: number) => [
      createDataRow(`Periode #${idx + 1} (${getLeaveTypeLabel(seg.leaveType)})`, `${formatDate(seg.startDate)} s/d ${formatDate(seg.endDate)} (${Number(seg.totalDays)} Hari Kerja)`)
    ]),
    createDataRow("Total Durasi Pengajuan", `${totalDays} Hari Kerja`, true),
    createDataRow("Alasan / Penjelasan", leave.reason),

    // Section 3: Status Approval
    createSectionHeader("STATUS APPROVAL"),
    createDataRow("Status Pengajuan", leave.status, true),
  ];

  if (leave.status !== "PENDING") {
    rows.push(createDataRow("Diproses Oleh", reviewerName || "System"));
    if (leave.reviewedAt) {
      rows.push(createDataRow("Waktu Proses", formatDate(leave.reviewedAt)));
    }
    if (leave.rejectionNote) {
      rows.push(createDataRow("Catatan Penolakan", leave.rejectionNote));
    }
  }

  const detailsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noneBorders,
    rows
  });

  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noneBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noneBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 1200 }, // spacer height
                children: [
                  new TextRun({
                    text: "Yang Mengajukan,",
                    font: "Calibri",
                    size: 22
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: leave.user.name,
                    bold: true,
                    underline: {},
                    font: "Calibri",
                    size: 22
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Karyawan",
                    font: "Calibri",
                    size: 20,
                    color: "555555"
                  })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noneBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 1200 }, // spacer height
                children: [
                  new TextRun({
                    text: "Menyetujui / Mengetahui,",
                    font: "Calibri",
                    size: 22
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: reviewerName || "( _____________________ )",
                    bold: !!reviewerName,
                    underline: reviewerName ? {} : undefined,
                    font: "Calibri",
                    size: 22
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "HRD / Atasan",
                    font: "Calibri",
                    size: 20,
                    color: "555555"
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "FORM PENGAJUAN CUTI KARYAWAN",
                bold: true,
                font: "Calibri",
                size: 32
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "Sistem Manajemen Cuti & Izin — Web Cuti",
                font: "Calibri",
                size: 20,
                color: "555555"
              })
            ]
          }),
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.DOUBLE, size: 24, color: "0F172A" }
            },
            spacing: { after: 300 },
            children: []
          }),
          detailsTable,
          new Paragraph({ spacing: { before: 800 }, children: [] }),
          signatureTable
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Form_Cuti_${leave.user.name.replace(/\s+/g, "_")}_${formatDate(earliestStart).replace(/\s+/g, "_")}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
