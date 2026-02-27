import Image from "next/image";

const utilities = [
  {
    image: "/debugging.png",
    title: "Rapid Debugging",
    description:
      "Identify broken references or malformed nodes in massive datasets instantly.",
    bgColor: "bg-[#00B3B7]/10",
    iconColor: "text-[#00B3B7]",
    borderColor: "border-[#00B3B7]/20",
  },
  {
    image: "/data-mapping.png",
    title: "Data Mapping",
    description:
      "Visualize complex API responses to better understand internal dependencies.",
    bgColor: "bg-emerald-50",
    iconColor: "text-emerald-600",
    borderColor: "border-emerald-100",
  },
  {
    image: "/documentation.png",
    title: "Documentation",
    description:
      "Export high-fidelity diagrams for your internal technical documentation.",
    bgColor: "bg-purple-50",
    iconColor: "text-purple-600",
    borderColor: "border-purple-100",
  },
];

export default function ProductivitySection() {
  return (
    <section
      className="py-16 md:py-24 bg-[linear-gradient(100deg,rgba(250,250,250,1)_0%,rgba(255,255,255,1)_100%)] border-y border-zinc-100 relative overflow-hidden"
      id="utility"
    >
      <div className="absolute left-0 top-0 h-full hidden md:block w-[600px] z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('/grid-pattern.png')`,
            backgroundRepeat: "repeat",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-5 md:mb-10 space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1A1D1B]">
            Maximize Your Productivity
          </h2>
          <p className="text-zinc-600 text-lg md:text-xl max-w-2xl mx-auto">
            Seamlessly integrate JSON Rock into your daily development workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-12 bg-white rounded-2xl md:rounded-3xl p-4 md:p-0">
          {utilities.map((utility, index) => (
            <UtilityCard key={index} {...utility} />
          ))}
        </div>
      </div>

      <div className="absolute right-0 top-0 h-full hidden md:block w-[600px] z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('/grid-pattern.png')`,
            backgroundRepeat: "repeat",
          }}
        />
      </div>
    </section>
  );
}

function UtilityCard({
  image,
  title,
  description,
}: {
  image: string;
  title: string;
  description: string;
  bgColor: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-4 p-6 md:p-8">
      <div
        className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl flex items-center justify-center p-4 pb-0 mb-2 transition-transform hover:scale-105 duration-300`}
      >
        <div className="relative w-full h-full">
          <Image src={image} alt={title} fill className="object-contain" />
        </div>
      </div>
      <h4 className="text-xl md:text-2xl font-bold text-[#1A1D1B]">{title}</h4>
      <p className="text-base text-paragraph font-medium leading-relaxed max-w-xs mx-auto">
        {description}
      </p>
    </div>
  );
}
