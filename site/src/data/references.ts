/** Every work any chapter cites, keyed by a stable id; a chapter lists the ids it uses in its `references` frontmatter. */
export interface Reference {
    authors: string;
    title: string;
    venue: string;
    year: number;
    url?: string;
    /** What the libraries take from it, shown in the chapter's reference list. */
    note?: string;
}

export const references: Record<string, Reference> = {
    mueller2012thesis: {
        authors: "Daniel Müller (now Limberger)",
        title: "Photorealistisches Rendering atmosphärischer Effekte in geovirtuellen 3D-Umgebungen in Echtzeit",
        venue: "Master's thesis, Hasso Plattner Institute, Potsdam (German)",
        year: 2012,
        url: "https://daniellimberger.de/resources/2012%20%E2%80%93%20Mueller%20%28now%20Limberger%29%20%E2%80%93%20Photorealistisches%20Rendering%20atmosphaerischer%20Effekte%20in%20geovirtuellen%203D-Umgebungen%20in%20Echtzeit.pdf",
        note: "osgHimmel, the original C++ implementation all himmel libraries are ported from.",
    },
    mueller2012vmv: {
        authors: "Daniel Müller (now Limberger), Juri Engel, Jürgen Döllner",
        title: "Single-Pass Rendering of Day and Night Sky Phenomena",
        venue: "Vision, Modeling and Visualization (VMV)",
        year: 2012,
        url: "https://diglib.eg.org/items/0b9332fd-d155-452a-b9e0-1c605d557730",
    },
    meeus1998: {
        authors: "Jean Meeus",
        title: "Astronomical Algorithms",
        venue: "2nd edition, Willmann-Bell",
        year: 1998,
        note: "The precise variants' main source.",
    },
    jensen2001: {
        authors: "Henrik Wann Jensen, Frédo Durand, Julie Dorsey, Michael M. Stark, Peter Shirley, Simon Premože",
        title: "A Physically-Based Night Sky Model",
        venue: "SIGGRAPH",
        year: 2001,
        url: "https://graphics.cs.yale.edu/publications/physically-based-night-sky-model",
        note: "The approximate variants' main source.",
    },
    bretagnon1982: {
        authors: "Pierre Bretagnon",
        title: "Théorie du mouvement de l'ensemble des planètes. Solution VSOP82",
        venue: "Astronomy and Astrophysics 114",
        year: 1982,
        note: "Earth's orbital eccentricity.",
    },
    bennett1982: {
        authors: "G. G. Bennett",
        title: "The Calculation of Astronomical Refraction in Marine Navigation",
        venue: "Journal of Navigation 35",
        year: 1982,
        note: "Atmospheric refraction from the apparent altitude.",
    },
    saemundsson1986: {
        authors: "Þorsteinn Sæmundsson",
        title: "Atmospheric Refraction",
        venue: "Sky and Telescope 72",
        year: 1986,
        note: "Atmospheric refraction from the true altitude.",
    },
    nishita1993: {
        authors: "Tomoyuki Nishita, Takao Sirai, Katsumi Tadamura, Eihachiro Nakamae",
        title: "Display of the Earth Taking into Account Atmospheric Scattering",
        venue: "SIGGRAPH",
        year: 1993,
    },
    bruneton2008: {
        authors: "Eric Bruneton, Fabrice Neyret",
        title: "Precomputed Atmospheric Scattering",
        venue: "Computer Graphics Forum 27(4), EGSR",
        year: 2008,
        url: "https://inria.hal.science/inria-00288758",
    },
    nssdc: {
        authors: "NASA Space Science Data Coordinated Archive",
        title: "Planetary Fact Sheets: Earth, Moon, Sun",
        venue: "nssdc.gsfc.nasa.gov",
        year: 2024,
        url: "https://nssdc.gsfc.nasa.gov/planetary/planetfact.html",
        note: "Mean radii and similar constants.",
    },
};
