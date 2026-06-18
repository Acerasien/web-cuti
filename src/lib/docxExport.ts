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

function getExcuseTypeLabel(type: string): string {
  const map: Record<string, string> = {
    TIDAK_ABSEN_MASUK: "Tidak Absen Masuk",
    TIDAK_ABSEN_PULANG: "Tidak Absen Pulang",
    DATANG_TERLAMBAT: "Datang Terlambat / Pulang Awal",
    CUTI_TAHUNAN: "Cuti Tahunan",
    IZIN_LAINNYA: "Izin Lainnya",
  };
  return map[type] ?? type;
}

function getLeaveTypeLabel(type: string): string {
  const map: Record<string, string> = {
    PERNIKAHAN_KARYAWAN: "Pernikahan Karyawan",
    PERNIKAHAN_ANAK: "Pernikahan Anak Kandung",
    KHITAN_BAPTIS: "Khitan / Baptis Anak Kandung",
    ISTRI_MELAHIRKAN: "Istri Melahirkan / Keguguran",
    KEMATIAN_KELUARGA: "Kematian Keluarga",
    KARYAWATI_MELAHIRKAN: "Karyawati Melahirkan",
    KARYAWATI_KEGUGURAN: "Karyawati Keguguran",
    SAKIT: "Sakit (Dengan Surat Dokter)",
  };
  return map[type] ?? type;
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

export async function exportExcuseToDocx(excuse: any, reviewerName: string) {
  const isSingle = new Date(excuse.dateFrom).getTime() === new Date(excuse.dateTo).getTime();
  const dateText = isSingle
    ? formatDate(excuse.dateFrom)
    : `${formatDate(excuse.dateFrom)} s/d ${formatDate(excuse.dateTo)}`;

  const rows = [
    // Section 1: Data Karyawan
    createSectionHeader("DATA KARYAWAN"),
    createDataRow("Nama Lengkap", excuse.user.name, true),
    createDataRow("Jabatan / Posisi", excuse.user.position || "—"),
    createDataRow("Departemen", excuse.user.department || "—"),
    createDataRow("Email", excuse.user.email || "—"),

    // Section 2: Detail Pengajuan
    createSectionHeader("DETAIL PENGAJUAN"),
    createDataRow("Jenis Izin", getExcuseTypeLabel(excuse.excuseType), true),
    createDataRow("Tanggal Kejadian", dateText),
    createDataRow("Durasi Pengajuan", `${Number(excuse.totalDays || 0)} Hari`),
    createDataRow("Alasan / Penjelasan", excuse.reason),

    // Section 3: Status Approval
    createSectionHeader("STATUS APPROVAL"),
    createDataRow("Status Pengajuan", excuse.status, true),
  ];

  if (excuse.status !== "PENDING") {
    rows.push(createDataRow("Diproses Oleh", reviewerName || "System"));
    if (excuse.reviewedAt) {
      rows.push(createDataRow("Waktu Proses", formatDate(excuse.reviewedAt)));
    }
    if (excuse.rejectionNote) {
      rows.push(createDataRow("Catatan Penolakan", excuse.rejectionNote));
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
                    text: excuse.user.name,
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
                text: "FORM PENGAJUAN IZIN KARYAWAN",
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
  a.download = `Form_Izin_${excuse.user.name.replace(/\s+/g, "_")}_${formatDate(excuse.dateFrom).replace(/\s+/g, "_")}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportLeaveToDocx(leave: any, reviewerName: string) {
  const dateText = `${formatDate(leave.startDate)} s/d ${formatDate(leave.endDate)}`;

  const rows = [
    // Section 1: Data Karyawan
    createSectionHeader("DATA KARYAWAN"),
    createDataRow("Nama Lengkap", leave.user.name, true),
    createDataRow("Jabatan / Posisi", leave.user.position || "—"),
    createDataRow("Departemen", leave.user.department || "—"),
    createDataRow("Email", leave.user.email || "—"),

    // Section 2: Detail Pengajuan
    createSectionHeader("DETAIL PENGAJUAN"),
    createDataRow("Jenis Cuti", getLeaveTypeLabel(leave.leaveType), true),
    createDataRow("Tanggal Cuti", dateText),
    createDataRow("Durasi Cuti", `${leave.totalDays} Hari Kerja`),
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
  a.download = `Form_Cuti_${leave.user.name.replace(/\s+/g, "_")}_${formatDate(leave.startDate).replace(/\s+/g, "_")}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
