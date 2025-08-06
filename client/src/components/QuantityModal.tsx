import React, { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  Button,
  Typography,
  Modal,
  Stack,
  TextField,
  useTheme,
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import Tooltip from '@mui/material/Tooltip';

interface QuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  max: number;
  min: number;
  initialAmount?: number;
  title?: string;
  symbol: string;
  score: number;
  price: number;
  type: "buy" | "sell";
  maxMoney?: number;
}

export const QuantityModal: React.FC<QuantityModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  max,
  min,
  initialAmount = 1,
  title,
  symbol,
  price,
  type,
  maxMoney,
}) => {
  const maxSharesByMoney = maxMoney !== undefined ? Math.floor(maxMoney / price) : max;
  const effectiveMax = Math.min(max, maxSharesByMoney);

  const [amount, setAmount] = useState(initialAmount);
  const theme = useTheme();

  // Reset amount when modal opens
  useEffect(() => {
    if (isOpen) setAmount(initialAmount);
  }, [isOpen, initialAmount]);

  // Close modal on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const adjustAmount = (delta: number) => {
    setAmount((a) => Math.min(effectiveMax, Math.max(min, a + delta)));
  };

  return createPortal(
    <Modal open={isOpen} onClose={onClose} aria-labelledby="quantity-modal-title" closeAfterTransition>
      <Box
        sx={{
          position: "absolute" as const,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          bgcolor: theme.palette.background.paper,
          p: 4,
          borderRadius: 2,
          minWidth: 320,
          maxWidth: "90vw",
          boxShadow: 24,
          outline: "none",
        }}
      >
        {/* Title and total cost */}
        <Typography id="quantity-modal-title" variant="h6" fontWeight="bold" gutterBottom>
          {title} {symbol} @ ${price} per share
        </Typography>

        <Typography variant="subtitle1" mb={3}>
          {amount} share{amount !== 1 ? "s" : ""} × {price} ={" "}
          <Box component="span" color={theme.palette.primary.main} fontWeight="bold">
            ${(amount * price).toFixed(2)}
          </Box>
        </Typography>

        {/* Buttons for increments */}
<Stack direction="row" spacing={2} flexWrap="wrap" mb={2} alignItems="center" justifyContent="space-between">
  {/* Increment buttons */}
  <Stack direction="row" spacing={1}>
    {[1, 10, 100].map((n) => (
      <Tooltip key={`plus-${n}`} title={`Add ${n}`}>
        <Button
          variant="outlined"
          size="small"
          color={type === "buy" ? "error" : "success"}
          onClick={() => adjustAmount(n)}
          startIcon={<AddIcon />}
        >
          {n}
        </Button>
      </Tooltip>
    ))}

    <Tooltip title={`Set to max (${effectiveMax})`}>
      <Button
        variant="contained"
        size="small"
        color={type === "buy" ? "error" : "success"}
        onClick={() => setAmount(effectiveMax)}
      >
        Max ({effectiveMax})
      </Button>
    </Tooltip>
  </Stack>

  {/* Decrement buttons */}
  <Stack direction="row" spacing={1}>
    {[1, 10, 100].map((n) => (
      <Tooltip key={`minus-${n}`} title={`Subtract ${n}`}>
        <Button
          variant="outlined"
          size="small"
          color="inherit"
          onClick={() => adjustAmount(-n)}
          startIcon={<RemoveIcon />}
        >
          {n}
        </Button>
      </Tooltip>
    ))}

    {min === 0 && (
      <Tooltip title="Set to zero">
        <Button
          variant="contained"
          size="small"
          color="inherit"
          onClick={() => setAmount(0)}
        >
          Zero
        </Button>
      </Tooltip>
    )}
  </Stack>
</Stack>

        {/* Show max shares by money if relevant */}
        {maxMoney !== undefined && maxSharesByMoney < max && (
          <Typography variant="caption" color="text.secondary" mb={2}>
            Max shares allowed by your budget ${maxMoney}: ({maxSharesByMoney})
          </Typography>
        )}

        {/* Number input */}
        <TextField
          type="number"
          inputProps={{ min, max: effectiveMax, step: 1 }}
          value={amount}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (!isNaN(val)) setAmount(Math.min(effectiveMax, Math.max(min, val)));
          }}
          fullWidth
          size="small"
          sx={{ mb: 3, bgcolor: "background.paper", borderRadius: 1 }}
        />

        {/* Cancel / Confirm */}
        <Stack direction="row" justifyContent="flex-end" spacing={2}>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => { onConfirm(amount); onClose(); }}>
            Confirm
          </Button>
        </Stack>
      </Box>
    </Modal>,
    document.body
  );
};