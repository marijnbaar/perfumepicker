import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Heart, Bookmark, Droplet, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// PerfumeCard: Weergeeft een parfum met geordende noten en een actieknop.
const PerfumeCard = ({ perfume, onAction, actionType = "add" }) => {
  const categorizeNotes = (notesString) => {
    const categories = {
      topNotes: ['bergamot', 'citrus', 'lavender', 'pepper'],
      middleNotes: ['jasmine', 'rose', 'iris', 'violet'],
      baseNotes: ['vanilla', 'musk', 'sandalwood', 'amber']
    };

    const notes = notesString.toLowerCase().split(',').map(note => note.trim());

    return {
      top: notes.filter(note => categories.topNotes.some(n => note.includes(n))),
      middle: notes.filter(note => categories.middleNotes.some(n => note.includes(n))),
      base: notes.filter(note => categories.baseNotes.some(n => note.includes(n))),
      other: notes.filter(note =>
        !categories.topNotes.some(n => note.includes(n)) &&
        !categories.middleNotes.some(n => note.includes(n)) &&
        !categories.baseNotes.some(n => note.includes(n))
      )
    };
  };

  const notes = categorizeNotes(perfume.notes);

  // NoteSection: Render een sectie met noten met een icoon en kleur.
  const NoteSection = ({ title, notes, color }) => (
    notes.length > 0 && (
      <div className="mb-2">
        <div className="flex items-center gap-1 mb-1">
          <Droplet className={`w-3 h-3 ${color}`} />
          <span className="text-sm font-normal">{title}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {notes.map((note, idx) => (
            <span 
              key={idx}
              className={`text-xs px-2 py-1 rounded-full bg-opacity-20 ${color.replace('text-', 'bg-')}`}
            >
              {note}
            </span>
          ))}
        </div>
      </div>
    )
  );

  return (
    <Card className="group transition-all duration-300 hover:shadow-lg overflow-hidden animate__animated animate__fadeInUp">
      <CardContent className="p-0">
        <div className="flex">
          <div className="w-32 h-40 flex-shrink-0">
            <img 
              src="/api/placeholder/128/160" 
              alt={perfume.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-light mb-2 text-teal-800">{perfume.name}</h3>
                <p className="text-gray-600 mb-4 font-light">{perfume.description}</p>
                
                <div className="bg-teal-50 rounded-lg p-4">
                  <NoteSection title="Topnoten" notes={notes.top} color="text-yellow-500" />
                  <NoteSection title="Hartnoten" notes={notes.middle} color="text-pink-500" />
                  <NoteSection title="Basisnoten" notes={notes.base} color="text-teal-500" />
                  <NoteSection title="Overige noten" notes={notes.other} color="text-blue-500" />
                </div>
              </div>
              <button
                onClick={() => onAction(perfume)}
                className="ml-4 p-2 hover:bg-gray-100 rounded-full transition-all duration-300"
              >
                <Heart className={`h-5 w-5 ${
                  actionType === "remove" ? "fill-red-500 text-red-500" : "text-gray-400"
                }`} />
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Hoofdcomponent: Parfum Aanbevelingsapplicatie
const PerfumeRecommendationApp = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [shelf, setShelf] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Verwerk het uploaden van een afbeelding en converteer deze naar base64
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setUploadedImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // Voer de zoekopdracht uit via een API-endpoint. De query kan tekst en/of een afbeelding bevatten.
  const performSearch = async () => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (uploadedImage) params.append('img', uploadedImage);
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) throw new Error('Fout bij het ophalen van zoekresultaten');
      const data = await response.json();
      setSearchResults(data.matches || []);
    } catch (error) {
      console.error("Error tijdens zoeken:", error);
    }
    setIsSearching(false);
  };

  // Voor demo/doeleinden: fallback naar mock-data indien er geen API beschikbaar is.
  const mockSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      setSearchResults([
        {
          id: 1,
          name: 'Chanel No. 5',
          description: 'Een tijdloze bloemen-aldehyde geur, de essentie van verfijning.',
          notes: 'aldehydes, jasmijn, roos, ylang-ylang, iris, vanille, sandelhout'
        },
        {
          id: 2,
          name: 'Dior Sauvage',
          description: 'Fris en gedurfd, een kenmerkende geur die een onmiskenbaar spoor achterlaat.',
          notes: 'bergamot, peper, lavendel, amber, vanille'
        },
        {
          id: 3,
          name: 'Le Labo Santal 33',
          description: 'Een unisex geur die de geest van het Amerikaanse Westen vangt.',
          notes: 'kardemom, iris, violet, sandelhout, musk, amber'
        }
      ]);
      setIsSearching(false);
    }, 1000);
  };

  // Voeg een parfum toe aan je "shelf"
  const addToShelf = (perfume) => {
    if (!shelf.find(p => p.id === perfume.id)) {
      setShelf([...shelf, perfume]);
    }
  };

  // Verwijder een parfum van je "shelf"
  const removeFromShelf = (perfume) => {
    setShelf(shelf.filter(p => p.id !== perfume.id));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gradient-to-b from-teal-50 to-white min-h-screen font-light">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-light mb-2 text-teal-800">Parfum Aanbevelingsapplicatie</h1>
        <p className="text-teal-600">Ontdek nieuwe geuren en bewaar je favorieten</p>
      </div>

      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="search" className="text-lg data-[state=active]:bg-teal-100 font-light">
            <Search className="w-4 h-4 mr-2" />
            Zoeken
          </TabsTrigger>
          <TabsTrigger value="shelf" className="text-lg data-[state=active]:bg-teal-100 font-light">
            <Bookmark className="w-4 h-4 mr-2" />
            Mijn Shelf
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <Card className="bg-white/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-teal-800 font-light">
                Zoek in de Fragrantica-content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center">
                <Input
                  placeholder="Voer een zoekterm in (bijv. geur, naam of noten)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <label htmlFor="image-upload" className="cursor-pointer inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded">
                  <Upload className="w-4 h-4" />
                  <span>Upload Afbeelding</span>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                <Button 
                  onClick={performSearch} // Vervang eventueel door mockSearch() als er geen API beschikbaar is
                  disabled={(!searchQuery && !uploadedImage) || isSearching}
                  className="bg-teal-600 hover:bg-teal-700 font-light"
                >
                  {isSearching ? 'Zoeken...' : 'Zoek'}
                </Button>
              </div>

              <div className="space-y-4">
                {searchResults.map((perfume) => (
                  <PerfumeCard
                    key={perfume.id}
                    perfume={perfume}
                    onAction={addToShelf}
                    actionType="add"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shelf">
          <Card className="bg-white/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-teal-800 font-light">
                Mijn Favoriete Parfums
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shelf.length === 0 ? (
                <Alert className="bg-teal-50">
                  <AlertDescription className="font-light">
                    Je shelf is leeg. Voeg favorieten toe via de zoekfunctie.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {shelf.map((perfume) => (
                    <PerfumeCard
                      key={perfume.id}
                      perfume={perfume}
                      onAction={removeFromShelf}
                      actionType="remove"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerfumeRecommendationApp;
