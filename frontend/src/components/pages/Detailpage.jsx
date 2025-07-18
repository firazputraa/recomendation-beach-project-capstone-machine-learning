// DetailPage.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DetailTemplate } from '../templates/DetailTemplate';
import beach from "../../assets/beach.png";
import toast from 'react-hot-toast';

const DetailPage = () => {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const { user, isLoggedIn, token } = useAuth();
  const swiperRef = useRef(null);

  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [newFeedback, setNewFeedback] = useState({ rating: 0, comment: '' });
  const [feedbacks, setFeedbacks] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [recommendedPlaces, setRecommendedPlaces] = useState([]);
  const [imageLoadErrors, setImageLoadErrors] = useState(new Set());

  // Helper function to convert degrees to radians
  const toRad = (v) => (v * Math.PI) / 180; // Not used in this component, but good to keep if needed

  // Parses coordinate string "lat,lng" into a [lat, lng] array
  const parseCoordinates = (coordString) => {
    if (!coordString) return [-6.2088, 106.8456]; // Default to Jakarta if no coordinates
    const [latStr, lngStr] = coordString.split(',');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    return (isNaN(lat) || isNaN(lng)) ? [-6.2088, 106.8456] : [lat, lng];
  };

  // Processes image URLs, ensuring there are always 5 images (filling with default if needed)
  const processImages = (place) => {
    let arr = Array.isArray(place.featured_image)
      ? place.featured_image
      : place.featured_image?.split(',') || [];
    if (arr.length === 0 && place.image_urls) arr = place.image_urls.split(',');
    arr = arr.filter(u => u).slice(0, 5);
    while (arr.length < 5) arr.push(beach); // Ensure at least 5 images
    return arr;
  };

  // Handles star click for review rating input
  const handleStarClick = useCallback((rating) => {
    setNewFeedback(prev => ({ ...prev, rating }));
  }, []);

  // Handles submission of a new review
  const handleSubmitReview = useCallback(async () => {
    if (!isLoggedIn) {
      toast.error("Silakan login untuk memberikan review.");
      return;
    }

    const hasReviewed = feedbacks.some(r => r.userId === user?.id);
    if (hasReviewed) {
      toast.error("Kamu sudah memberikan review untuk tempat ini.");
      return;
    }

    if (newFeedback.rating === 0) {
      toast.error("Rating tidak boleh kosong.");
      return;
    }
    if (newFeedback.comment.trim() === "") {
      toast.error("Komentar tidak boleh kosong.");
      return;
    }

    try {
      const payload = {
        placeId,
        rating: newFeedback.rating,
        review_text: newFeedback.comment.trim(),
      };

      const res = await fetch('https://recommendation-beach-backend-production.up.railway.app/review/', { // Ensure this URL matches your Node.js backend
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(err.message || `Failed to submit review: ${res.status}`);
      }

      const addedReviewData = await res.json();
      const addedReview = addedReviewData.review; // Extract the 'review' object from the response

      setFeedbacks(prev => [
        {
          ...addedReview,
          id: addedReview.id, // Ensure id is present
          userId: addedReview.userId,
          name: user.username, // Use current user's username
          comment: addedReview.review_text,
          rating: addedReview.rating,
          sentiment: addedReview.average_sentiment, // Get sentiment from backend response
          timestamp: addedReview.createdAt,
        },
        ...prev, // Add new review to the top
      ]);
      setNewFeedback({ rating: 0, comment: '' }); // Reset form
      toast.success('Review berhasil ditambahkan!');

    } catch (e) {
      console.error("Error submitting review:", e);
      toast.error(`Gagal submit review: ${e.message}`);
    }
  }, [feedbacks, user, placeId, newFeedback, token, isLoggedIn]);


  // Handles deletion of a review
  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedReview) return;
    try {
      const res = await fetch(`https://recommendation-beach-backend-production.up.railway.app/review/${selectedReview.id}`, { // Ensure this URL matches your Node.js backend
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(err.message || `Failed to delete review: ${res.status}`);
      }
      setFeedbacks(prev => prev.filter(r => r.id !== selectedReview.id));
      setSelectedReview(null);
      setDeleteModalOpen(false);
      toast.success('Review berhasil dihapus');
    } catch (e) {
      console.error("Error deleting review:", e);
      toast.error(`Gagal menghapus review: ${e.message}`);
    }
  }, [selectedReview, token]);

  // Handles updating an existing review
  const handleUpdateReview = useCallback(async (reviewId, updatedComment, updatedRating) => {
    try {
      if (updatedRating === 0) {
        toast.error("Rating tidak boleh kosong.");
        return;
      }
      if (updatedComment.trim() === "") {
        toast.error("Komentar tidak boleh kosong.");
        return;
      }

      const payload = {
        review_text: updatedComment.trim(),
        rating: updatedRating,
      };

      const res = await fetch(`https://recommendation-beach-backend-production.up.railway.app/review/${reviewId}`, { // Ensure this URL matches your Node.js backend
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(err.message || `Failed to update review: ${res.status}`);
      }

      const updatedReviewData = await res.json();
      const updatedReview = updatedReviewData.review; // Extract the 'review' object from the response

      setFeedbacks(prev =>
        prev.map(r =>
          r.id === reviewId
            ? {
              ...r,
              comment: updatedReview.review_text,
              rating: updatedReview.rating,
              sentiment: updatedReview.average_sentiment, // Get sentiment from backend response
              timestamp: updatedReview.updatedAt || updatedReview.createdAt, // Use updatedAt if available
            }
            : r
        )
      );
      setEditModalOpen(false);
      setSelectedReview(null);
      toast.success('Review berhasil diperbarui!');
    } catch (e) {
      console.error("Error updating review:", e);
      toast.error(`Gagal memperbarui review: ${e.message}`);
    }
  }, [token]);

  // Sets the selected review for editing
  const handleEditClick = useCallback((rev) => {
    setSelectedReview(rev);
    setEditModalOpen(true);
  }, []);

  // Sets the selected review for deletion
  const handleDeleteClick = useCallback((rev) => {
    setSelectedReview(rev);
    setDeleteModalOpen(true);
  }, []);

  // Handles image loading errors to replace broken images
  const handleImageError = useCallback((url) => {
    setImageLoadErrors(s => new Set(s).add(url));
  }, []);

  // Scrolls to top on placeId change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [placeId]);

  // Fetches place details
  useEffect(() => {
    const fetchPlaceDetails = async () => {
      if (!placeId) {
        setError('No place ID provided.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`https://recommendation-beach-backend-production.up.railway.app/beach/${placeId}`); // Adjust URL if needed
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error(res.status === 404 ? 'Beach not found.' : err.message || 'Failed to fetch place details.');
        }
        setPlace(await res.json());
      } catch (e) {
        console.error("Error fetching place details:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPlaceDetails();
  }, [placeId]);

  // Fetches reviews for the place
  useEffect(() => {
    const fetchReviews = async () => {
      if (!placeId) return;
      try {
        const res = await fetch(`https://recommendation-beach-backend-production.up.railway.app/review/${placeId}`); // Ensure this URL matches your Node.js backend
        if (res.ok) {
          const data = await res.json();
          setFeedbacks(data.reviews.map(r => ({
            ...r,
            id: r.id,
            userId: r.userId, // Ensure userId is available
            name: r.user?.username || 'Anonymous', // Safely get username
            comment: r.review_text,
            rating: r.rating,
            sentiment: r.average_sentiment,
            timestamp: r.createdAt
          })));
        } else {
          console.error(`Failed to fetch reviews: ${res.status}`);
        }
      } catch (e) {
        console.error("Error fetching reviews:", e);
      }
    };
    fetchReviews();
  }, [placeId]);

  // Fetches recommended places (nearby)
  useEffect(() => {
    const fetchRecommendedPlaces = async () => {
      if (!place?.coordinates) return;
      const [lat, lng] = parseCoordinates(place.coordinates);
      try {
        const res = await fetch(`https://recommendation-beach-backend-production.up.railway.app/beach/nearby?lat=${lat}&lng=${lng}&radius=50&limit=10`); // Adjust URL if needed
        if (res.ok) {
          const json = await res.json();
          setRecommendedPlaces(json.data.filter(p => p.place_Id !== placeId));
        } else {
          console.error(`Failed to fetch recommended places: ${res.status}`);
        }
      } catch (e) {
        console.error("Error fetching recommended places:", e);
      }
    };
    fetchRecommendedPlaces();
  }, [place, placeId]);

  if (loading) return <div className="text-center p-8">Loading...</div>;
  if (error || !place) return <div className="text-center p-8 text-red-500">Error: {error || 'Place not found.'}</div>;

  return (
    <DetailTemplate
      place={place}
      finalMainImages={processImages(place)}
      coordinates={parseCoordinates(place.coordinates)}
      recommendedPlaces={recommendedPlaces}
      isLoggedIn={isLoggedIn}
      user={user}
      newFeedback={newFeedback}
      setNewFeedback={setNewFeedback}
      handleStarClick={handleStarClick}
      handleSubmitReview={handleSubmitReview}
      feedbacks={feedbacks}
      setFeedbacks={setFeedbacks}
      swiperRef={swiperRef}
      openDropdownId={openDropdownId}
      setOpenDropdownId={setOpenDropdownId}
      handleEditClick={handleEditClick}
      handleDeleteClick={handleDeleteClick}
      handleDeleteConfirm={handleDeleteConfirm}
      handleUpdateReview={handleUpdateReview}
      editModalOpen={editModalOpen}
      setEditModalOpen={setEditModalOpen}
      deleteModalOpen={deleteModalOpen}
      setDeleteModalOpen={setDeleteModalOpen}
      selectedReview={selectedReview}
      setSelectedReview={setSelectedReview}
      handleImageError={handleImageError}
      imageLoadErrors={imageLoadErrors}
    />
  );
};

export default DetailPage;