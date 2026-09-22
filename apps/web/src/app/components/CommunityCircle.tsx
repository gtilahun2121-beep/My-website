'use client';

interface PersonProps {
  name: string;
  color: string;
  position: {
    top: string;
    left: string;
  };
}

const Person = ({ name, color, position }: PersonProps) => (
  <div
    className="absolute w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg hover:scale-110 transition-transform"
    style={{
      backgroundColor: color,
      top: position.top,
      left: position.left,
    }}
  >
    <div className="text-3xl">👤</div>
  </div>
);

export default function CommunityCircle() {
  const people: PersonProps[] = [
    {
      name: 'Person 1',
      color: '#3B82F6', // Blue
      position: { top: '10%', left: '5%' },
    },
    {
      name: 'Person 2',
      color: '#FCA5A5', // Light Red/Pink
      position: { top: '5%', left: '40%' },
    },
    {
      name: 'Person 3',
      color: '#F59E0B', // Amber/Orange
      position: { top: '15%', left: '72%' },
    },
    {
      name: 'Person 4',
      color: '#A78BFA', // Purple
      position: { top: '50%', left: '88%' },
    },
    {
      name: 'Person 5',
      color: '#60A5FA', // Light Blue
      position: { top: '82%', left: '75%' },
    },
    {
      name: 'Person 6',
      color: '#FB7185', // Rose/Red
      position: { top: '88%', left: '42%' },
    },
    {
      name: 'Person 7',
      color: '#4F46E5', // Indigo
      position: { top: '78%', left: '8%' },
    },
    {
      name: 'Person 8',
      color: '#BFDBFE', // Very Light Blue
      position: { top: '48%', left: '2%' },
    },
  ];

  return (
    <div className="relative w-full max-w-md aspect-square">
      {/* Central circle container */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center shadow-2xl">
        {/* Inner circle with text */}
        <div className="text-center space-y-3">
          <div className="text-5xl">🤝</div>
          <p className="text-lg font-bold text-blue-900">Join Our</p>
          <p className="text-lg font-bold text-blue-900">Community</p>
        </div>

        {/* People in circle around the center */}
        {people.map((person, index) => (
          <Person key={index} {...person} />
        ))}
      </div>
    </div>
  );
}
