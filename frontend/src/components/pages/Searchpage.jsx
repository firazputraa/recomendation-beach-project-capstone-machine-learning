import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Star, ChevronLeft, ChevronRight, ExternalLink, Info, Frown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext'; // Pastikan path ini benar

const Searchpage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { token } = useAuth(); // Ambil token dari AuthContext

    const [results, setResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [searchMode, setSearchMode] = useState('search'); // 'search' or 'recommend'
    const [isNearbySearch, setIsNearbySearch] = useState(false);
    const [userLocation, setUserLocation] = useState(null); // { lat, lng }

    const itemsPerPage = 10; // Sesuaikan dengan limit backend Anda untuk pencarian

    // Fungsi untuk mendapatkan token JWT dari localStorage
    // Ini bisa dihilangkan jika Anda sudah menggunakan `useAuth().token` secara konsisten
    const getAuthToken = () => {
        return localStorage.getItem('token');
    };

    // Render bintang rating (tetap sama)
    const renderStars = (rating) => {
        const stars = [];
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;
        for (let i = 0; i < fullStars; i++) {
            stars.push(<Star key={`full-${i}`} className="w-4 h-4 text-yellow-400 fill-current" />);
        }
        if (hasHalfStar) {
            stars.push(
                <svg key="half" className="w-4 h-4 text-yellow-400" viewBox="0 0 20 20">
                    <defs>
                        <linearGradient id="half-star-gradient">
                            <stop offset="50%" stopColor="currentColor"/>
                            <stop offset="50%" stopColor="transparent" stopOpacity="0.3"/>
                        </linearGradient>
                    </defs>
                    <path fill="url(#half-star-gradient)" d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                </svg>
            );
        }
        const emptyStars = 5 - Math.ceil(rating);
        for (let i = 0; i < emptyStars; i++) {
            stars.push(<Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />);
        }
        return stars;
    };

    // **LOGIKA FETCHING DATA UTAMA DARI SINI**
    const performSearch = useCallback(async (query, page, mode, isNearby = false, locationData = null) => {
        // Jika tidak ada query dan bukan pencarian terdekat, kosongkan hasil
        if (!query && !isNearby) {
            setResults([]);
            setTotalCount(0);
            setTotalPages(0);
            return;
        }

        setIsLoading(true);
        setSearchMode(mode); // Pastikan mode selalu terupdate

        let url = '';
        let params = {};
        let headers = {};

        const currentToken = token || getAuthToken(); // Gunakan token dari context atau localStorage

        // Tentukan URL dan parameter berdasarkan mode pencarian
        if (isNearby) { // Prioritaskan nearby jika aktif
            url = 'https://recommendation-beach-backend-production.up.railway.app/beach/nearby';
            params = { lat: locationData.lat, lng: locationData.lng, radius: 50, limit: itemsPerPage, page: page };
            setSearchQuery('nearby'); // Update query untuk URL
            setIsNearbySearch(true); // Pastikan state ini aktif
            setSearchMode('search'); // Nearby adalah bagian dari mode 'search'
        } else if (mode === 'search') {
            url = 'https://recommendation-beach-backend-production.up.railway.app/beach/search';
            params = { search: query, limit: itemsPerPage, page: page };
            setIsNearbySearch(false); // Pastikan state ini nonaktif
        } else if (mode === 'recommend') {
            if (!currentToken) {
                alert('Anda harus login untuk mendapatkan rekomendasi personalisasi.');
                setIsLoading(false);
                setResults([]);
                return;
            }
            url = 'https://recommendation-beach-backend-production.up.railway.app/beach/recommend';
            // Perhatian: Di sini backend Anda kemungkinan besar butuh `query` sebagai `preference_text`
            // Periksa lagi error 400 sebelumnya. Jika masih muncul, coba ubah nama parameter `preference_text`
            // sesuai yang diharapkan backend (misal: 'text', 'query', 'preferenceText')
            params = { preference_text: query, top_n: itemsPerPage }; 
            headers = { Authorization: `Bearer ${currentToken}` };
            setIsNearbySearch(false); // Pastikan state ini nonaktif
        }

        try {
            let response;
            let fetchedResults = [];
            let totalFetchedCount = 0;
            let totalFetchedPages = 0;

            if (mode === 'recommend') {
                console.log('Sending recommendation POST request:');
                console.log('URL:', url);
                console.log('Params (body):', params);
                console.log('Headers:', headers);
                // Untuk rekomendasi, lakukan POST dan kemudian GET detail
                response = await axios.post(url, params, { headers });
                const recommendedPlaceIds = response.data.recommendations;

                if (recommendedPlaceIds && recommendedPlaceIds.length > 0) {
                    const detailedRecommendations = await Promise.all(
                        recommendedPlaceIds.map(async (rec) => {
                            try {
                                const detailResponse = await axios.get(`https://recommendation-beach-backend-production.up.railway.app/beach/${rec.placeId}`, {
                                    headers: { Authorization: `Bearer ${currentToken}` }
                                });
                                return { ...detailResponse.data, score: rec.score }; // Pertahankan score
                            } catch (detailError) {
                                console.error(`Error fetching detail for placeId ${rec.placeId}:`, detailError);
                                return null;
                            }
                        })
                    );
                    fetchedResults = detailedRecommendations.filter(Boolean);
                    totalFetchedCount = fetchedResults.length;
                    totalFetchedPages = Math.ceil(fetchedResults.length / itemsPerPage); // Akan jadi 1 jika hasil < itemsPerPage
                }
            } else {
                console.log('Sending GET request:');
                console.log('URL:', url);
                console.log('Params (query):', params);
                console.log('Headers:', headers); // Mungkin kosong untuk GET, itu normal
                // Untuk search dan nearby, lakukan GET langsung
                response = await axios.get(url, { params, headers });
                fetchedResults = response.data.data;
                totalFetchedCount = response.data.count;
                totalFetchedPages = Math.ceil(response.data.count / response.data.limit);
            }

            setResults(fetchedResults);
            setTotalCount(totalFetchedCount);
            setTotalPages(totalFetchedPages);
            setCurrentPage(page);

            // Perbarui URL dan state browser agar konsisten
            let newUrl = `/search?search=${encodeURIComponent(query || '')}&page=${page}&mode=${mode}`;
            if (isNearby) {
                newUrl += '&nearby=true';
            }
            navigate(newUrl, {
                replace: true,
                state: {
                    results: fetchedResults,
                    totalCount: totalFetchedCount,
                    currentPage: page,
                    totalPages: totalFetchedPages,
                    hasMore: totalFetchedCount > (page * itemsPerPage), // Logic hasMore
                    searchMode: mode,
                    isNearbySearch: isNearby,
                    userLocation: locationData
                },
            });

        } catch (error) {
            console.error('Error during search:', error);
            let errorMessage = 'Gagal memuat hasil pencarian. ';
            if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
                errorMessage = 'Sesi Anda telah habis atau Anda belum login. Silakan login kembali.';
            } else if (axios.isAxiosError(error) && error.response) {
                // Tampilkan pesan error spesifik dari backend jika ada
                errorMessage += `Error server: ${error.response.status}. Detail: ${error.response.data.message || JSON.stringify(error.response.data)}`;
            } else if (axios.isAxiosError(error) && error.request) {
                errorMessage += 'Tidak dapat terhubung ke server.';
            } else {
                errorMessage += error.message;
            }
            alert(errorMessage + ' Silakan coba lagi.');
            setResults([]);
            setTotalCount(0);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    }, [itemsPerPage, navigate, token]); // Dependencies: pastikan token ada di sini

    // LOGIKA INITIAL LOAD DAN URL PARSING (tidak ada perubahan di sini)
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const initialSearch = queryParams.get('search') || '';
        const initialPage = parseInt(queryParams.get('page')) || 1;
        const initialMode = queryParams.get('mode') || 'search';
        const initialIsNearby = queryParams.get('nearby') === 'true';

        setSearchQuery(initialSearch);
        setCurrentPage(initialPage);
        setSearchMode(initialMode);
        setIsNearbySearch(initialIsNearby);

        if (location.state) {
            setResults(location.state.results || []);
            setTotalCount(location.state.totalCount || 0);
            setTotalPages(location.state.totalPages || 0);
            setCurrentPage(location.state.currentPage || 1);
            setSearchMode(location.state.searchMode || 'search');
            setIsNearbySearch(location.state.isNearbySearch || false);
            setUserLocation(location.state.userLocation || null);
            setIsLoading(false);
        } else if (initialSearch || initialIsNearby) {
            if (initialIsNearby && !userLocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        const loc = { lat: latitude, lng: longitude };
                        setUserLocation(loc);
                        performSearch(initialSearch, initialPage, initialMode, true, loc);
                    },
                    (error) => {
                        console.error('Geolocation error on Searchpage initial load:', error);
                        alert('Tidak dapat mengakses lokasi Anda untuk pencarian terdekat.');
                        setIsLoading(false);
                        setResults([]);
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
                );
            } else {
                performSearch(initialSearch, initialPage, initialMode, initialIsNearby, userLocation);
            }
        }
    }, [location.search, location.state, performSearch, userLocation]);

    // Event Handlers (tetap sama)
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        performSearch(searchQuery, 1, searchMode);
    };

    const handleNearbySearch = async () => {
        setIsLoading(true);
        setSearchQuery('');
        try {
            if (!navigator.geolocation) {
                alert('Geolocation tidak didukung oleh browser ini.');
                setIsLoading(false);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const loc = { lat: latitude, lng: longitude };
                    setUserLocation(loc);
                    await performSearch('nearby', 1, 'search', true, loc);
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    let errorMessage = 'Tidak dapat mengakses lokasi Anda. ';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += 'Mohon izinkan akses lokasi untuk menemukan pantai terdekat.'; break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += 'Informasi lokasi tidak tersedia.'; break;
                        case error.TIMEOUT:
                            errorMessage += 'Permintaan lokasi habis waktu.'; break;
                        default:
                            errorMessage += 'Terjadi kesalahan yang tidak diketahui.'; break;
                    }
                    alert(errorMessage);
                    setIsLoading(false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
            );
        } catch (error) {
            console.error('Error initiating nearby search:', error);
            alert('Terjadi kesalahan saat mencari pantai terdekat.');
            setIsLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        performSearch(searchQuery, newPage, searchMode, isNearbySearch, userLocation);
    };

    const handleDetailClick = (placeId) => {
        navigate(`/detail/${placeId}`);
    };

    // Render JSX
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-extrabold text-sky-900 mb-8 text-center">
                    Beach search results
                </h1>

                {/* Search Bar on Searchpage */}
                <div className="relative mb-8 bg-white p-6 rounded-xl shadow-md">
                    {/* Mode Toggle Buttons */}
                    <div className="flex bg-gray-100 rounded-full p-1 mb-4 shadow-inner">
                        <button
                            onClick={() => setSearchMode('search')}
                            className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
                                searchMode === 'search'
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            Search
                        </button>
                        <button
                            onClick={() => setSearchMode('recommend')}
                            className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
                                searchMode === 'recommend'
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            Recommend
                        </button>
                    </div>

                    <form onSubmit={handleSearchSubmit} className="flex items-center space-x-3">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={
                                searchMode === 'search'
                                    ? "Search for beaches (name, location, activities...)"
                                    : "Describe your dream beach (calm, clear, family-friendly...)"
                            }
                            className="flex-1 px-5 py-3 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-base"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            className="bg-sky-500 text-white p-3 rounded-full hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 transition-colors duration-200 flex items-center justify-center w-12 h-12 flex-shrink-0"
                            disabled={isLoading}
                        >
                            {isLoading && (searchMode === 'search' || isNearbySearch) ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            )}
                        </button>
                    </form>
                    <div className="mt-4 text-center">
                        <button
                            onClick={handleNearbySearch}
                            disabled={isLoading}
                            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading && isNearbySearch ? (
                                <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                            ) : (
                                <MapPin className="w-4 h-4 mr-2" />
                            )}
                            {isLoading && isNearbySearch ? 'Searching for location...' : 'Find the Nearest Beach'}
                        </button>
                    </div>
                </div>

                {isLoading && !isNearbySearch && searchQuery !== 'nearby' ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="text-center">
                            <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading search results...</p>
                        </div>
                    </div>
                ) : results.length > 0 ? (
                    <>
                        <p className="text-gray-700 mb-6 text-center text-lg font-semibold">
                            Found {totalCount} results for "
                            <span className="text-sky-600 font-bold">{searchQuery || (isNearbySearch ? 'Nearest Beach' : 'Recommendation')}</span>"
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {results.map((beach) => (
                                <div
                                    key={beach.placeId}
                                    className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col md:flex-row transition-all duration-300 hover:shadow-xl"
                                >
                                    <div className="relative w-full h-48 md:w-1/3 md:h-auto flex-shrink-0">
                                        <img
                                            // **PERUBAHAN DI SINI:** Ambil elemen pertama dari array featured_image
                                            src={beach.featured_image && beach.featured_image.length > 0 ? beach.featured_image[0] : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400'}
                                            alt={beach.name || beach.place_name}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            loading="lazy"
                                            onError={(e) => {
                                                // Pastikan fallback hanya sekali
                                                if (e.target.src !== 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400') {
                                                    e.target.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400';
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="p-5 flex flex-col flex-grow">
                                        <h2 className="font-bold text-xl text-gray-800 mb-2">
                                            {/* Gunakan beach.place_name sesuai JSON Anda */}
                                            {beach.place_name || beach.name}
                                        </h2>
                                        <div className="flex items-center gap-1 mb-3">
                                            <div className="flex">
                                                {renderStars(beach.rating || 0)}
                                            </div>
                                            <span className="text-sm text-gray-500 ml-1">
                                                {(beach.rating || 0).toFixed(1)}
                                                {searchMode === 'recommend' && beach.score !== undefined && (
                                                    <span className="ml-2 text-blue-600 font-semibold">({(beach.score * 100).toFixed(0)}% Match)</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-start text-gray-600 text-sm mb-4">
                                            <MapPin className="w-4 h-4 mr-2 mt-0.5 text-sky-500 flex-shrink-0" />
                                            <span>{beach.address || 'Lokasi tidak tersedia'}</span>
                                        </div>
                                        <p className="text-gray-700 text-sm line-clamp-3 mb-4">
                                            {/* Gunakan beach.description langsung. Jika '-', akan ditampilkan '-' */}
                                            {beach.description || 'Deskripsi tidak tersedia.'}
                                        </p>
                                        <div className="mt-auto flex space-x-3">
                                            <button
                                                onClick={() => handleDetailClick(beach.placeId)}
                                                className="flex-1 text-sm bg-sky-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-sky-600 transition-colors flex items-center justify-center gap-1"
                                            >
                                                <Info className="w-4 h-4" />
                                                Detail
                                            </button>
                                            <a
                                                href={beach.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 text-sm bg-gray-100 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Maps
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center mt-10 space-x-2">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => handlePageChange(page)}
                                        className={`px-4 py-2 rounded-full font-semibold transition-colors duration-200 ${
                                            currentPage === page
                                                ? 'bg-sky-500 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-5 h-5 text-gray-700" />
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center text-gray-500 py-20">
                        <Frown className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-xl font-semibold mb-2">Tidak ada hasil ditemukan.</p>
                        <p>Coba kata kunci lain atau gunakan fitur rekomendasi.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Searchpage;